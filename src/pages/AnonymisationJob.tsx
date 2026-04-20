import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Job = {
  id: string;
  status: string;
  risk_score: number | null;
  detected_fields: unknown;
  removed_fields: unknown;
  flagged_for_review: boolean;
  report_html: string | null;
  error_message: string | null;
  created_at: string;
};

const AnonymisationJob = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<Job | null | "missing">(null);

  useEffect(() => {
    if (!jobId) return;
    supabase
      .from("anonymisation_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle()
      .then(({ data }) => setJob(data ? (data as Job) : "missing"));
  }, [jobId]);

  if (job === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (job === "missing") {
    return (
      <div className="container mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-muted-foreground">Report not found.</p>
        <Link to="/dashboard/listings" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to listings
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-4xl px-6 py-10">
        <Link
          to="/dashboard/listings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to listings
        </Link>

        {job.report_html ? (
          <div
            className="mt-6 rounded-2xl border border-border bg-card p-2 overflow-hidden"
            style={{ boxShadow: "var(--shadow-soft)" }}
          >
            <iframe
              srcDoc={job.report_html}
              className="w-full rounded-xl"
              style={{ minHeight: "80vh", border: "none" }}
              title="Anonymisation Report"
              sandbox="allow-same-origin"
            />
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-border bg-card px-6 py-10 text-center">
            {job.status === "failed" ? (
              <>
                <p className="font-medium text-destructive">Analysis failed</p>
                <p className="mt-1 text-sm text-muted-foreground">{job.error_message ?? "Unknown error"}</p>
              </>
            ) : (
              <>
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">Report is being generated…</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnonymisationJob;
