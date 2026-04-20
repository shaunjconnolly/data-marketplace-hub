import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type DSR = {
  id: string;
  user_id: string;
  email: string;
  request_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  pending:    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  processing: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  completed:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected:   "bg-muted text-muted-foreground",
};

const TYPE_LABELS: Record<string, string> = {
  export:       "Data export",
  erasure:      "Erasure (right to be forgotten)",
  rectification:"Rectification",
  restriction:  "Restriction of processing",
};

const AdminGdpr = () => {
  const [requests, setRequests] = useState<DSR[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [working, setWorking] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("data_subject_requests")
      .select("*")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error("Could not load requests"); setRequests([]); return; }
    setRequests((data ?? []) as DSR[]);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!requests) return [];
    const q = search.trim().toLowerCase();
    return requests.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return r.email.toLowerCase().includes(q) || r.request_type.toLowerCase().includes(q);
    });
  }, [requests, search, filter]);

  async function advance(id: string, newStatus: "processing" | "completed" | "rejected") {
    setWorking(id);
    const { error } = await supabase
      .from("data_subject_requests")
      .update({ status: newStatus })
      .eq("id", id);
    setWorking(null);
    if (error) { toast.error("Could not update request"); return; }
    toast.success(`Marked as ${newStatus}`);

    // If completing an erasure, call the cascade function
    const dsr = requests?.find((r) => r.id === id);
    if (newStatus === "completed" && dsr?.request_type === "erasure") {
      const { error: eraseErr } = await supabase.rpc("process_erasure_request", {
        p_user_id: dsr.user_id,
      });
      if (eraseErr) toast.error("Erasure cascade failed: " + eraseErr.message);
      else toast.success("User data erased successfully");
    }

    setRequests((rs) => rs?.map((r) => r.id === id ? { ...r, status: newStatus, updated_at: new Date().toISOString() } : r) ?? null);
  }

  const pendingCount = (requests ?? []).filter((r) => r.status === "pending").length;

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            GDPR requests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {requests === null ? "Loading…" : `${filtered.length} requests`}
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <Clock className="h-3 w-3" />{pendingCount} pending
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search email or request type…"
          className="max-w-xs"
        />
        <div className="flex gap-1">
          {(["all", "pending", "processing", "completed", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {requests === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
            No requests match.
          </div>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-soft)" }}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[r.status] ?? ""}`}>
                      {r.status}
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {TYPE_LABELS[r.request_type] ?? r.request_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {new Date(r.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.email}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground/60">{r.user_id}</p>
                  {r.notes && (
                    <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground">{r.notes}</p>
                  )}
                  {r.status !== "pending" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last updated: {new Date(r.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>

                {(r.status === "pending" || r.status === "processing") && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {r.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={working === r.id}
                        onClick={() => advance(r.id, "processing")}
                      >
                        {working === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Clock className="mr-1.5 h-3.5 w-3.5" />}
                        Start processing
                      </Button>
                    )}
                    <Button
                      size="sm"
                      disabled={working === r.id}
                      onClick={() => advance(r.id, "completed")}
                    >
                      {working === r.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                      Mark completed
                      {r.request_type === "erasure" && " + erase data"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={working === r.id}
                      onClick={() => advance(r.id, "rejected")}
                    >
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        GDPR Art. 17 erasure requests must be completed within 30 days of receipt.
        Art. 20 export requests must be fulfilled within 30 days.
      </p>
    </div>
  );
};

export default AdminGdpr;
