import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type PayoutRequest = {
  id: string;
  seller_id: string;
  amount: number;
  currency: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_FILTERS = ["all", "pending", "approved", "paid", "rejected"] as const;

function statusCls(s: string) {
  if (s === "paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (s === "approved") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  if (s === "rejected") return "bg-destructive/10 text-destructive";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const AdminPayouts = () => {
  const [rows, setRows] = useState<PayoutRequest[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("payout_requests")
      .select("id,seller_id,amount,currency,status,notes,admin_notes,created_at,updated_at")
      .order("created_at", { ascending: false });
    if (error) { toast.error("Could not load payout requests"); setRows([]); return; }
    setRows((data ?? []) as PayoutRequest[]);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string, admin_notes?: string) {
    setUpdating(id);
    const { error } = await supabase
      .from("payout_requests")
      .update({ status, ...(admin_notes != null ? { admin_notes } : {}) })
      .eq("id", id);
    setUpdating(null);
    if (error) { toast.error("Could not update: " + error.message); return; }
    toast.success(`Marked as ${status}`);
    setRows((r) => r?.map((row) => row.id === id ? { ...row, status, admin_notes: admin_notes ?? row.admin_notes } : row) ?? null);
  }

  const filtered = rows?.filter((r) => filter === "all" || r.status === filter) ?? [];

  const totals = rows
    ? {
        pending: rows.filter((r) => r.status === "pending").reduce((s, r) => s + Number(r.amount), 0),
        approved: rows.filter((r) => r.status === "approved").reduce((s, r) => s + Number(r.amount), 0),
        paid: rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0),
      }
    : null;

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Seller payout requests — review, approve and mark paid.</p>
      </header>

      {totals && (
        <div className="mt-6 grid grid-cols-3 gap-4">
          {[
            { label: "Pending", value: totals.pending, cls: "text-amber-600" },
            { label: "Approved (not yet paid)", value: totals.approved, cls: "text-blue-600" },
            { label: "Total paid out", value: totals.paid, cls: "text-emerald-600 dark:text-emerald-400" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${cls}`}>{fmt(value)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === s
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {s === "all" ? `All (${rows?.length ?? 0})` : `${s} (${rows?.filter((r) => r.status === s).length ?? 0})`}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        {rows === null ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            {filter === "all" ? "No payout requests yet." : `No ${filter} requests.`}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-4 py-3">Seller</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.seller_id.slice(0, 8)}…
                  </td>
                  <td className="px-4 py-3 font-semibold tabular-nums text-foreground">
                    {fmt(Number(r.amount))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusCls(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {r.admin_notes ?? r.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {r.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updating === r.id}
                            onClick={() => updateStatus(r.id, "approved")}
                          >
                            {updating === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                            <span className="ml-1.5">Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={updating === r.id}
                            onClick={() => updateStatus(r.id, "rejected")}
                          >
                            <XCircle className="h-3 w-3" />
                            <span className="ml-1.5">Reject</span>
                          </Button>
                        </>
                      )}
                      {r.status === "approved" && (
                        <Button
                          size="sm"
                          disabled={updating === r.id}
                          onClick={() => updateStatus(r.id, "paid", "Payment processed")}
                        >
                          {updating === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Mark paid
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

export default AdminPayouts;
