import { useEffect, useState } from "react";
import { ArrowDownToLine, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Earnings = {
  total_earned: number;
  total_requested: number;
  total_paid_out: number;
  available: number;
};

type PayoutRequest = {
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
};

type Purchase = {
  id: string;
  total_amount: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
  listings: { title: string } | null;
};

function statusIcon(s: string) {
  if (s === "paid") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (s === "approved") return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
  if (s === "rejected") return <XCircle className="h-4 w-4 text-destructive" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
}

function statusCls(s: string) {
  if (s === "paid") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
  if (s === "approved") return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300";
  if (s === "rejected") return "bg-destructive/10 text-destructive";
  return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const Payouts = () => {
  const { user } = useAuth();
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [requests, setRequests] = useState<PayoutRequest[] | null>(null);
  const [sales, setSales] = useState<Purchase[] | null>(null);
  const [requesting, setRequesting] = useState(false);

  async function load() {
    if (!user) return;
    const [earningsRes, requestsRes, salesRes] = await Promise.all([
      supabase.rpc("get_seller_earnings", { p_seller_id: user.id }),
      supabase
        .from("payout_requests")
        .select("id,amount,currency,status,notes,admin_notes,created_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("purchases")
        .select("id,total_amount,currency,paid_at,created_at,listings(title)")
        .eq("listings.seller_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    if (earningsRes.data && earningsRes.data.length > 0) {
      const r = earningsRes.data[0] as Earnings;
      setEarnings({
        total_earned: Number(r.total_earned),
        total_requested: Number(r.total_requested),
        total_paid_out: Number(r.total_paid_out),
        available: Number(r.available),
      });
    } else {
      setEarnings({ total_earned: 0, total_requested: 0, total_paid_out: 0, available: 0 });
    }

    setRequests((requestsRes.data ?? []) as PayoutRequest[]);
    setSales((salesRes.data ?? []) as unknown as Purchase[]);
  }

  useEffect(() => { load(); }, [user]);

  async function requestPayout() {
    if (!earnings || earnings.available <= 0) return;
    setRequesting(true);
    const { error } = await supabase.from("payout_requests").insert({
      seller_id: user!.id,
      amount: earnings.available,
      currency: "USD",
    });
    setRequesting(false);
    if (error) { toast.error("Could not submit payout request: " + error.message); return; }
    toast.success("Payout request submitted — an admin will review it shortly.");
    load();
  }

  const hasPendingRequest = requests?.some((r) => ["pending", "approved"].includes(r.status));

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payouts</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your earnings from dataset sales.</p>
      </div>

      {/* ── Earnings summary ────────────────────────────────── */}
      {earnings === null ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { label: "Total earned", value: earnings.total_earned },
              { label: "Paid out", value: earnings.total_paid_out },
              { label: "Pending / approved", value: earnings.total_requested - earnings.total_paid_out },
              { label: "Available", value: earnings.available, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`mt-1 text-xl font-semibold tabular-nums ${highlight ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>
                  {fmt(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            {earnings.available <= 0 ? (
              <p className="text-sm text-muted-foreground">
                {hasPendingRequest
                  ? "You have a payout request in progress."
                  : "No balance available to request yet."}
              </p>
            ) : hasPendingRequest ? (
              <p className="text-sm text-muted-foreground">
                A payout request is already in progress — wait for it to be processed.
              </p>
            ) : (
              <Button onClick={requestPayout} disabled={requesting}>
                {requesting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDownToLine className="mr-2 h-4 w-4" />
                )}
                Request payout of {fmt(earnings.available)}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Payout history ──────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-foreground">Payout requests</h2>
        <div className="mt-3 space-y-2">
          {requests === null ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payout requests yet.</p>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                  {statusIcon(r.status)}
                  <div>
                    <p className="text-sm font-medium text-foreground">{fmt(r.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                      {r.admin_notes && <> · {r.admin_notes}</>}
                    </p>
                  </div>
                </div>
                <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusCls(r.status)}`}>
                  {r.status}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Sales breakdown ─────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-foreground">Recent sales</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card">
          {sales === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : sales.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
                  <th className="px-4 py-3">Dataset</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {s.listings?.title ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{fmt(s.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(s.paid_at ?? s.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
};

export default Payouts;
