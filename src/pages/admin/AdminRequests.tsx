import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Inbox, Loader2, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { captureError } from "@/lib/events";
import type { AccessRequestStatus } from "@/lib/listings";

type Row = {
  id: string;
  status: AccessRequestStatus;
  message: string | null;
  created_at: string;
  buyer_id: string;
  listing_id: string;
  listing_title: string;
  buyer_name: string | null;
};

const AdminRequests = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AccessRequestStatus>("all");
  const [working, setWorking] = useState<string | null>(null);

  async function load() {
    const { data: requests, error } = await supabase
      .from("access_requests")
      .select("id, status, message, created_at, buyer_id, listing_id")
      .order("created_at", { ascending: false });

    if (error) {
      captureError(error, { scope: "admin.requests.load" });
      toast.error("Could not load requests");
      setRows([]);
      return;
    }

    const listingIds = [...new Set((requests ?? []).map((r) => r.listing_id))];
    const buyerIds = [...new Set((requests ?? []).map((r) => r.buyer_id))];

    const [{ data: listings }, { data: profiles }] = await Promise.all([
      listingIds.length
        ? supabase.from("listings").select("id, title").in("id", listingIds)
        : Promise.resolve({ data: [] }),
      buyerIds.length
        ? supabase.from("profiles").select("id, display_name").in("id", buyerIds)
        : Promise.resolve({ data: [] }),
    ]);

    const listingMap = new Map((listings ?? []).map((l) => [l.id, l.title]));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    setRows(
      (requests ?? []).map((r) => ({
        ...r,
        status: r.status as AccessRequestStatus,
        listing_title: listingMap.get(r.listing_id) ?? "Unknown listing",
        buyer_name: profileMap.get(r.buyer_id) ?? null,
      })),
    );
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.listing_title.toLowerCase().includes(q) ||
        (r.buyer_name ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  async function decide(id: string, status: "approved" | "declined") {
    setWorking(id);
    const { error } = await supabase
      .from("access_requests")
      .update({ status })
      .eq("id", id);
    setWorking(null);
    if (error) {
      captureError(error, { scope: "admin.requests.decide" });
      toast.error("Could not update request");
      return;
    }
    toast.success(status === "approved" ? "Access approved" : "Request declined");
    setRows((rows) =>
      rows?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null,
    );
  }

  const pending = (rows ?? []).filter((r) => r.status === "pending").length;

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Access requests
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rows === null
            ? "Loading…"
            : `${filtered.length} request${filtered.length !== 1 ? "s" : ""}${pending > 0 ? ` · ${pending} pending` : ""}`}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search listing or buyer…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "pending", "approved", "declined"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === s
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {rows === null ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
            <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">No requests</p>
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </div>
                <Link
                  to={`/marketplace/${r.listing_id}`}
                  className="mt-1 block truncate text-sm font-semibold text-foreground hover:text-primary"
                >
                  {r.listing_title}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Buyer: {r.buyer_name ?? "Anonymous"}
                </p>
                {r.message && (
                  <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-foreground">
                    "{r.message}"
                  </p>
                )}
              </div>
              {r.status === "pending" && (
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={working === r.id}
                    onClick={() => decide(r.id, "declined")}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    disabled={working === r.id}
                    onClick={() => decide(r.id, "approved")}
                  >
                    {working === r.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Approve
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function StatusBadge({ status }: { status: AccessRequestStatus }) {
  const styles: Record<AccessRequestStatus, string> = {
    pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    declined: "bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default AdminRequests;
