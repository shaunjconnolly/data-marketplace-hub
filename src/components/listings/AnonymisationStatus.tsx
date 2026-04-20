import { AlertTriangle, CheckCircle2, Clock, ExternalLink, Loader2, ShieldAlert, XCircle } from "lucide-react";

export type AnonJob = {
  job_id: string;
  status: "queued" | "processing" | "complete" | "failed";
  risk_score: number | null;
  detected_fields: { name: string; risk_level: string; match_reason: string }[];
  removed_fields: string[];
  flagged_for_review: boolean;
  row_count: number;
  error?: string;
};

type Props = { job: AnonJob | null; analysing: boolean };

function riskConfig(score: number) {
  if (score >= 0.60) return { label: "High risk", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: ShieldAlert };
  if (score >= 0.30) return { label: "Medium risk", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800", icon: AlertTriangle };
  return { label: "Low risk", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800", icon: CheckCircle2 };
}

const LEVEL_COLOUR: Record<string, string> = {
  critical: "text-destructive",
  high:     "text-amber-600 dark:text-amber-400",
  medium:   "text-yellow-600 dark:text-yellow-400",
  low:      "text-muted-foreground",
};

export function AnonymisationStatus({ job, analysing }: Props) {
  if (!analysing && !job) return null;

  // Running
  if (analysing || (job && job.status !== "complete" && job.status !== "failed")) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>Running PII scan and risk assessment…</span>
      </div>
    );
  }

  // Failed
  if (!job || job.status === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="text-sm font-medium text-destructive">Anonymisation check failed</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {job?.error ?? "Could not analyse the file. You can still save as draft."}
          </p>
        </div>
      </div>
    );
  }

  const score = job.risk_score ?? 0;
  const { label, color, bg, icon: Icon } = riskConfig(score);
  const pct = (score * 100).toFixed(1);

  return (
    <div className={`rounded-xl border px-4 py-3 ${bg}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${color}`} />
          <span className={`text-sm font-semibold ${color}`}>{label} — {pct}%</span>
          <span className="text-xs text-muted-foreground">
            · {job.row_count.toLocaleString()} rows scanned · {job.detected_fields.length} PII field{job.detected_fields.length !== 1 ? "s" : ""} found
          </span>
        </div>
        <a
          href={`/dashboard/anonymisation/${job.job_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Full report <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {job.detected_fields.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {job.detected_fields.map((f) => (
            <span
              key={f.name}
              className={`rounded-md bg-background/60 border border-border px-2 py-0.5 text-xs font-mono ${LEVEL_COLOUR[f.risk_level] ?? ""}`}
            >
              {f.name}
            </span>
          ))}
        </div>
      )}

      {score >= 0.60 && (
        <p className="mt-2 text-xs text-destructive font-medium">
          This dataset has been flagged for admin review. Publishing is blocked until cleared.
        </p>
      )}
      {score >= 0.30 && score < 0.60 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
          Remove or pseudonymise the high-risk fields above before publishing.
        </p>
      )}
      {score < 0.30 && (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
          Passed automated check. You can publish this listing.
        </p>
      )}

      {job.flagged_for_review && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
          <Clock className="h-3 w-3" />
          Pending admin review — you will be notified when cleared.
        </div>
      )}
    </div>
  );
}

/** Returns true when publishing is allowed based on job result */
export function canPublish(job: AnonJob | null): boolean {
  if (!job || job.status !== "complete") return false;
  if (job.flagged_for_review) return false;
  return (job.risk_score ?? 1) < 0.30;
}
