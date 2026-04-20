import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── PII taxonomy ─────────────────────────────────────────────────────────────

type RiskLevel = "critical" | "high" | "medium" | "low";

const PII_COLUMNS: Record<RiskLevel, string[]> = {
  critical: [
    "ssn","sin","ppsn","pps","passport","passport_number","national_id","national_id_number",
    "iban","bic","swift","account_number","card_number","credit_card","cvv",
    "tax_id","vat_number","medical_record","health_id","nhs_number",
    "diagnosis","prescription","medication","condition","biometric",
  ],
  high: [
    "email","email_address","phone","phone_number","mobile","mobile_number","tel","telephone",
    "address","street","street_address","full_address","postcode","postal_code","zip","zip_code","eircode",
    "ip","ip_address","device_id","mac_address","imei","cookie_id","user_id",
    "location","gps","latitude","longitude","lat","lon","lng","coordinates",
    "date_of_birth","dob","birth_date","birthdate",
  ],
  medium: [
    "name","full_name","fullname","first_name","firstname","last_name","lastname",
    "surname","forename","given_name","display_name",
    "age","gender","sex","race","ethnicity","nationality","religion","marital_status",
    "household_income","income","salary","wage",
  ],
  low: [
    "company","employer","employer_name","occupation","job_title","title","department",
    "industry","sector","country","city","town","region","county","state",
  ],
};

const RISK_WEIGHTS: Record<RiskLevel, number> = {
  critical: 0.35,
  high:     0.20,
  medium:   0.08,
  low:      0.03,
};

const CONTENT_PATTERNS: { name: string; pattern: RegExp; level: RiskLevel }[] = [
  { name: "email",       pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/, level: "high" },
  { name: "iban",        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}[A-Z0-9]{0,16}\b/, level: "critical" },
  { name: "ip_address",  pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,                       level: "high" },
  { name: "eircode",     pattern: /\b[A-Z]\d{2}\s?[A-Z0-9]{4}\b/i,                     level: "high" },
  { name: "uk_postcode", pattern: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i,            level: "high" },
  { name: "phone_ie",    pattern: /(\+353|083|085|086|087|089)\s?\d{3}\s?\d{4}/,        level: "high" },
  { name: "phone_uk",    pattern: /(\+44|07\d{3})\s?\d{3}\s?\d{4}/,                    level: "high" },
  { name: "phone_be",    pattern: /(\+32|04\d{2})\s?\d{2}\s?\d{2}\s?\d{2}/,            level: "high" },
  { name: "date_of_birth", pattern: /\b(19|20)\d{2}[-\/](0[1-9]|1[0-2])[-\/](0[1-9]|[12]\d|3[01])\b/, level: "medium" },
];

// ─── Parsing helpers ───────────────────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]);
  return lines.slice(1, 501).map((line) => {
    const vals = splitCSVLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ",") {
      out.push(cur.trim()); cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseRows(text: string, mime: string): Record<string, string>[] {
  const t = text.trim();
  if (mime === "text/csv" || (!t.startsWith("{") && !t.startsWith("["))) {
    return parseCSV(t);
  }
  try {
    const parsed = JSON.parse(t);
    if (Array.isArray(parsed)) return parsed.slice(0, 500);
    if (typeof parsed === "object") return [parsed];
  } catch {
    // Try NDJSON
    return t.split(/\r?\n/).filter(Boolean).slice(0, 500).flatMap((l) => {
      try { return [JSON.parse(l)]; } catch { return []; }
    });
  }
  return [];
}

// ─── PII detection ─────────────────────────────────────────────────────────────

type DetectedField = {
  name: string;
  risk_level: RiskLevel;
  match_reason: string;
  sample_values: string[];
};

function detectPII(rows: Record<string, string>[]): DetectedField[] {
  if (rows.length === 0) return [];
  const columns = Object.keys(rows[0]);
  const detected: DetectedField[] = [];
  const seen = new Set<string>();

  // Column name matching
  for (const col of columns) {
    const normalised = col.toLowerCase().replace(/[\s\-]/g, "_");
    for (const level of (["critical", "high", "medium", "low"] as RiskLevel[])) {
      if (PII_COLUMNS[level].some((p) => normalised === p || normalised.includes(p))) {
        const samples = rows.slice(0, 5).map((r) => String(r[col] ?? "")).filter(Boolean);
        detected.push({ name: col, risk_level: level, match_reason: "column_name", sample_values: samples });
        seen.add(col);
        break;
      }
    }
  }

  // Content pattern matching on unseen columns
  const sample = rows.slice(0, 50);
  for (const col of columns) {
    if (seen.has(col)) continue;
    const values = sample.map((r) => String(r[col] ?? "")).filter(Boolean);
    for (const { name, pattern, level } of CONTENT_PATTERNS) {
      const hits = values.filter((v) => pattern.test(v));
      if (hits.length >= Math.min(3, Math.ceil(values.length * 0.1))) {
        detected.push({
          name: col,
          risk_level: level,
          match_reason: `content_pattern:${name}`,
          sample_values: hits.slice(0, 3),
        });
        seen.add(col);
        break;
      }
    }
  }

  return detected;
}

function calcRiskScore(fields: DetectedField[]): number {
  const score = fields.reduce((sum, f) => sum + RISK_WEIGHTS[f.risk_level], 0);
  return Math.min(1.0, Math.round(score * 1000) / 1000);
}

// ─── HTML report ───────────────────────────────────────────────────────────────

function riskLabel(score: number) {
  if (score >= 0.60) return { text: "HIGH RISK", color: "#dc2626" };
  if (score >= 0.30) return { text: "MEDIUM RISK", color: "#d97706" };
  return { text: "LOW RISK", color: "#16a34a" };
}

function generateReport(params: {
  jobId: string;
  filePath: string;
  riskScore: number;
  detectedFields: DetectedField[];
  removedFields: string[];
  rowCount: number;
}): string {
  const { jobId, filePath, riskScore, detectedFields, removedFields, rowCount } = params;
  const { text: riskText, color: riskColor } = riskLabel(riskScore);
  const date = new Date().toISOString();
  const fieldRows = detectedFields.map((f) => `
    <tr>
      <td>${escHtml(f.name)}</td>
      <td style="color:${riskColor};font-weight:600;text-transform:uppercase">${f.risk_level}</td>
      <td>${escHtml(f.match_reason)}</td>
      <td>${f.sample_values.map((v) => `<code>${escHtml(maskValue(v))}</code>`).join(", ")}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Anonymisation Report — WeSourceData</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:860px;margin:40px auto;padding:0 24px;color:#0f172a}
  h1{font-size:1.5rem;margin-bottom:4px}
  .badge{display:inline-block;padding:4px 12px;border-radius:999px;font-weight:700;font-size:.85rem;color:#fff;background:${riskColor}}
  table{width:100%;border-collapse:collapse;margin-top:16px;font-size:.875rem}
  th{background:#f1f5f9;text-align:left;padding:8px 12px;font-weight:600}
  td{padding:8px 12px;border-top:1px solid #e2e8f0;vertical-align:top}
  code{background:#f1f5f9;padding:1px 4px;border-radius:4px;font-size:.8rem}
  .meta{color:#64748b;font-size:.85rem;margin-bottom:24px}
  .section{margin-top:32px}
  .removed{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;font-size:.875rem}
</style>
</head>
<body>
<h1>Anonymisation Report</h1>
<p class="meta">
  Job ID: <code>${escHtml(jobId)}</code> &nbsp;·&nbsp;
  File: <code>${escHtml(filePath.split("/").pop() ?? filePath)}</code> &nbsp;·&nbsp;
  Rows scanned: ${rowCount.toLocaleString()} &nbsp;·&nbsp;
  Generated: ${date}
</p>

<div class="section">
  <h2>Risk Assessment</h2>
  <span class="badge">${riskText}</span>
  <span style="margin-left:12px;font-size:1.25rem;font-weight:700">${(riskScore * 100).toFixed(1)}%</span>
  <p style="margin-top:8px;color:#475569;font-size:.9rem">
    ${riskScore >= 0.60
      ? "This dataset contains high-risk personal data. It has been flagged for manual admin review and cannot be published until cleared."
      : riskScore >= 0.30
      ? "This dataset contains personal data that requires additional review before publishing. Consider removing or pseudonymising the flagged fields."
      : "This dataset passed the automated risk check. Ensure all flagged fields below have been reviewed before publishing."}
  </p>
</div>

<div class="section">
  <h2>Detected PII Fields (${detectedFields.length})</h2>
  ${detectedFields.length === 0
    ? "<p style='color:#16a34a'>No PII fields detected.</p>"
    : `<table>
    <thead><tr><th>Column</th><th>Risk level</th><th>Detection method</th><th>Sample values (masked)</th></tr></thead>
    <tbody>${fieldRows}</tbody>
  </table>`}
</div>

${removedFields.length > 0 ? `
<div class="section">
  <h2>Recommended Removals</h2>
  <div class="removed">
    The following columns should be removed or pseudonymised before publishing:
    <strong>${removedFields.map(escHtml).join(", ")}</strong>
  </div>
</div>` : ""}

<div class="section">
  <h2>GDPR Obligations</h2>
  <ul style="font-size:.9rem;color:#475569;line-height:1.7">
    <li>Ensure a lawful basis (Art. 6 GDPR) exists for each personal data category above.</li>
    <li>Verify data subjects were informed of this secondary use at collection time, or obtain fresh consent.</li>
    <li>Apply pseudonymisation or anonymisation techniques to critical and high-risk fields before delivery.</li>
    <li>Record this processing activity in your Article 30 register.</li>
  </ul>
</div>

<footer style="margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:.8rem;color:#94a3b8">
  Generated by WeSourceData Anonymisation Pipeline · Ireland &amp; Belgium
</footer>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function maskValue(v: string): string {
  if (v.length <= 3) return "***";
  return v.slice(0, 2) + "*".repeat(Math.min(v.length - 2, 6)) + v.slice(-1);
}

// ─── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { limited } = await checkRateLimit(getClientIp(req), "anonymise-dataset", 10);
  if (limited) return rateLimitedResponse(corsHeaders);

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient    = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const { listing_id, file_path } = body ?? {};
    if (!file_path || typeof file_path !== "string") {
      return json({ error: "file_path is required" }, 400);
    }

    // Ownership check: file must be in the seller's own folder
    const folder = file_path.split("/")[0];
    if (folder !== user.id) return json({ error: "Forbidden" }, 403);

    // Create job record
    const { data: job, error: jobErr } = await serviceClient
      .from("anonymisation_jobs")
      .insert({ listing_id: listing_id ?? null, seller_id: user.id, file_path, status: "queued" })
      .select("id")
      .single();
    if (jobErr || !job) return json({ error: "Could not create job" }, 500);

    const jobId = job.id as string;

    // Mark processing
    await serviceClient.from("anonymisation_jobs")
      .update({ status: "processing" }).eq("id", jobId);

    // Download file from storage
    const { data: fileBlob, error: dlErr } = await serviceClient.storage
      .from("dataset-files").download(file_path);
    if (dlErr || !fileBlob) {
      await serviceClient.from("anonymisation_jobs")
        .update({ status: "failed", error_message: "Could not download file from storage" })
        .eq("id", jobId);
      return json({ error: "Could not read file" }, 500);
    }

    const text = await fileBlob.text();
    const mime = fileBlob.type || "text/plain";
    const rows = parseRows(text, mime);

    // Detect PII
    const detectedFields = detectPII(rows);
    const riskScore      = calcRiskScore(detectedFields);
    const removedFields  = detectedFields
      .filter((f) => f.risk_level === "critical" || f.risk_level === "high")
      .map((f) => f.name);
    const flagged        = riskScore > 0.60;

    // Generate HTML report
    const reportHtml = generateReport({
      jobId,
      filePath: file_path,
      riskScore,
      detectedFields,
      removedFields,
      rowCount: rows.length,
    });

    // Persist result
    await serviceClient.from("anonymisation_jobs").update({
      status:           "complete",
      risk_score:       riskScore,
      detected_fields:  detectedFields,
      removed_fields:   removedFields,
      flagged_for_review: flagged,
      report_html:      reportHtml,
    }).eq("id", jobId);

    // Audit log + admin notification when high-risk
    if (flagged) {
      await serviceClient.from("audit_log").insert({
        actor_id: user.id, actor_type: "user",
        entity_type: "anonymisation_job", entity_id: jobId,
        action: "high_risk_dataset_flagged",
        payload: { risk_score: riskScore, file_path, listing_id },
      });
    }

    await serviceClient.from("audit_log").insert({
      actor_id: user.id, actor_type: "user",
      entity_type: "anonymisation_job", entity_id: jobId,
      action: "anonymisation_complete",
      payload: { risk_score: riskScore, detected_count: detectedFields.length, flagged },
    });

    return json({
      ok: true,
      job_id:           jobId,
      status:           "complete",
      risk_score:       riskScore,
      detected_fields:  detectedFields,
      removed_fields:   removedFields,
      flagged_for_review: flagged,
      row_count:        rows.length,
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: message }, 500);
  }
});
