import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, RotateCcw, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Job = {
  id: string;
  listing_id: string | null;
  seller_id: string;
  file_path: string;
  status: string;
  risk_score: number | null;
  flagged_for_review: boolean;
  detected_fields: { name: string; risk_level: string }[] | null;
  error_message: string | null;
  created_at: string;
  listing_title: string | null;
};

function RiskBadge({ score, flagged }: { score: number | null; flagged: boolean }) {
  if (score === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (flagged || score >= 0.60) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
      <ShieldAlert className="h-3 w-3" />{(score * 100).toFixed(1)}%
    </span>
  );
  if (score >= 0.30) return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
      <AlertTriangle className="h-3 w-3" />{(score * 100).toFixed(1)}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
      <CheckCircle2 className="h-3 w-3" />{(score * 100).toFixed(1)}%
    </span>
  );
}

const AdminAnonymisation = () => {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("anonymisation_jobs")
      .select("id, listing_id, seller_id, file_path, status, risk_score, flagged_for_review, detected_fields, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    setLoading(false);
    if (error) { toast.error("Could not load jobs"); setJobs([]); return; }

    const listingIds = [...new Set((data ?? []).map((j) => j.listing_id).filter(Boolean))];
    const listingMap = new Map<string, string>();
    if (listingIds.length) {
      const { data: listings } = await supabase
        .from("listings").select("id, title").in("id", listingIds as string[]);
      (listings ?? []).forEach((l) => listingMap.set(l.id, l.title));
    }

    setJobs((data ?? []).map((j) => ({
      ...j,
      detected_fields: j.detected_fields as Job["detected_fields"],
      listing_title: j.listing_id ? (listingMap.get(j.listing_id) ?? "Unknown") : null,
    })));
  }

  useEffect(() => { load(); }, []);

  async function clearFlag(jobId: string) {
    setClearing(jobId);
    const { error } = await supabase
      .from("anonymisation_jobs")
      .update({ flagged_for_review: false })
      .eq("id", jobId);
    setClearing(null);
    if (error) { toast.error("Could not clear flag"); return; }
    toast.success("Flag cleared — seller can now publish");
    setJobs((js) => js?.map((j) => j.id === jobId ? { ...j, flagged_for_review: false } : j) ?? null);
  }

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const q = search.trim().toLowerCase();
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (statusFilter === "flagged" && !j.flagged_for_review) return false;
      if (!q) return true;
      return (
        (j.listing_title ?? "").toLowerCase().includes(q) ||
        j.file_path.toLowerCase().includes(q) ||
        j.seller_id.toLowerCase().includes(q)
      );
    });
  }, [jobs, search, statusFilter]);

  const flaggedCount = (jobs ?? []).filter((j) => j.flagged_for_review).length;

  return (
    <div className="container mx-auto max-w-7xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Anonymisation jobs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {jobs === null ? "Loading…" : `${filtered.length} jobs`}
            {flaggedCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                <ShieldAlert className="h-3 w-3" />{flaggedCount} flagged
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search listing, file, seller ID…"
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(["all", "complete", "failed", "flagged"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                statusFilter === s
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
        {jobs === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">No jobs match.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">PII fields</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((j) => (
                <tr key={j.id} className={j.flagged_for_review ? "bg-destructive/5" : "hover:bg-muted/20"}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {j.listing_title ?? <span className="text-muted-foreground">No listing</span>}
                    {j.flagged_for_review && (
                      <span className="ml-2 rounded-full bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive">flagged</span>
                    )}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-muted-foreground">
                    {j.file_path.split("/").pop()}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`capitalize text-xs font-medium ${
                      j.status === "complete" ? "text-emerald-600 dark:text-emerald-400" :
                      j.status === "failed"   ? "text-destructive" :
                      "text-amber-600 dark:text-amber-400"
                    }`}>{j.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge score={j.risk_score} flagged={j.flagged_for_review} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {j.detected_fields?.length ?? 0}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {new Date(j.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {j.listing_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={`/dashboard/anonymisation/${j.id}`} target="_blank" rel="noopener noreferrer">
                            Report
                          </a>
                        </Button>
                      )}
                      {j.flagged_for_review && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={clearing === j.id}
                          onClick={() => clearFlag(j.id)}
                        >
                          {clearing === j.id ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          )}
                          Clear flag
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminAnonymisation;
