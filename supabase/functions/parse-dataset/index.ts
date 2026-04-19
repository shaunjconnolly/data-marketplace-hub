import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SAMPLE_LIMIT = 10;
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB safety cap

type ParseResult = {
  sample: unknown[];
  total_records: number;
  detected_format: "json" | "ndjson" | "csv";
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"') {
        inQuotes = true;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): ParseResult {
  // Normalize line endings, strip trailing newline
  const normalized = text.replace(/\r\n?/g, "\n").replace(/\n+$/g, "");
  if (!normalized) {
    return { sample: [], total_records: 0, detected_format: "csv" };
  }

  // Split into lines respecting quoted newlines is non-trivial;
  // we accept that quoted newlines may inflate line count slightly.
  const lines = normalized.split("\n");
  if (lines.length === 0) {
    return { sample: [], total_records: 0, detected_format: "csv" };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const dataLines = lines.slice(1).filter((l) => l.length > 0);
  const total = dataLines.length;

  const sample: Record<string, string>[] = [];
  for (let i = 0; i < Math.min(SAMPLE_LIMIT, dataLines.length); i++) {
    const cells = splitCsvLine(dataLines[i]);
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c] || `col_${c + 1}`] = cells[c] ?? "";
    }
    sample.push(row);
  }

  return { sample, total_records: total, detected_format: "csv" };
}

function parseJsonLike(text: string): ParseResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { sample: [], total_records: 0, detected_format: "json" };
  }

  // Try strict JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return {
        sample: parsed.slice(0, SAMPLE_LIMIT),
        total_records: parsed.length,
        detected_format: "json",
      };
    }
    // Single object
    return {
      sample: [parsed],
      total_records: 1,
      detected_format: "json",
    };
  } catch {
    // Fall through to NDJSON
  }

  // NDJSON: one JSON value per line
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const sample: unknown[] = [];
  for (let i = 0; i < Math.min(SAMPLE_LIMIT, lines.length); i++) {
    try {
      sample.push(JSON.parse(lines[i]));
    } catch {
      sample.push({ value: lines[i] });
    }
  }
  return {
    sample,
    total_records: lines.length,
    detected_format: "ndjson",
  };
}

function detectAndParse(text: string, mime: string, name: string): ParseResult {
  const lower = (name || "").toLowerCase();
  const isCsv =
    mime === "text/csv" ||
    lower.endsWith(".csv") ||
    mime === "application/csv";
  const isJson =
    mime === "application/json" ||
    mime === "application/x-ndjson" ||
    mime === "application/jsonl" ||
    lower.endsWith(".json") ||
    lower.endsWith(".ndjson") ||
    lower.endsWith(".jsonl");

  if (isCsv && !isJson) return parseCsv(text);
  if (isJson && !isCsv) return parseJsonLike(text);

  // Heuristic fallback: look at first non-whitespace char
  const firstChar = text.trim()[0];
  if (firstChar === "[" || firstChar === "{") return parseJsonLike(text);
  return parseCsv(text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 20 parses per IP per minute — authenticated sellers uploading files
  const { limited } = await checkRateLimit(getClientIp(req), "parse-dataset", 20);
  if (limited) return rateLimitedResponse(corsHeaders);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(
        JSON.stringify({ error: "Server is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify the caller
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const filePath: string | undefined = body?.file_path;
    const fileMime: string = body?.file_mime ?? "";
    const fileName: string = body?.file_original_name ?? "";

    if (!filePath || typeof filePath !== "string") {
      return new Response(JSON.stringify({ error: "file_path is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce that the file is in the user's own folder
    const folder = filePath.split("/")[0];
    if (folder !== userId) {
      return new Response(
        JSON.stringify({ error: "Cannot parse files outside your folder" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Use service-role to download (bucket is private)
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: fileData, error: dlErr } = await admin.storage
      .from("dataset-files")
      .download(filePath);
    if (dlErr || !fileData) {
      return new Response(
        JSON.stringify({ error: dlErr?.message ?? "Could not read file" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (fileData.size > MAX_BYTES) {
      return new Response(
        JSON.stringify({
          error: `File is too large to parse (>${MAX_BYTES / (1024 * 1024)} MB)`,
        }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const text = await fileData.text();
    const result = detectAndParse(text, fileMime, fileName);

    return new Response(
      JSON.stringify({
        ok: true,
        sample: result.sample,
        total_records: result.total_records,
        detected_format: result.detected_format,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("parse-dataset error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
