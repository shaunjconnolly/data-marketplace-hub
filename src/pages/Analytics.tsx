import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, ShoppingBag, DollarSign, BarChart2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { formatPrice } from "@/lib/listings";
import { captureError } from "@/lib/events";

type Purchase = {
  id: string;
  total_amount: number;
  currency: string;
  paid_at: string | null;
  created_at: string;
  listing_id: string;
  listing: { id: string; title: string } | null;
};

type ListingStat = {
  id: string;
  title: string;
  sales: number;
  revenue: number;
  currency: string;
};

type MonthlyBar = { month: string; revenue: number };

function buildMonthlyBars(purchases: Purchase[]): MonthlyBar[] {
  const now = new Date();
  const bars: MonthlyBar[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bars.push({
      month: d.toLocaleString("default", { month: "short", year: "2-digit" }),
      revenue: 0,
    });
  }
  const earliest = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  for (const p of purchases) {
    const date = new Date(p.paid_at ?? p.created_at);
    if (date < earliest) continue;
    const key = date.toLocaleString("default", { month: "short", year: "2-digit" });
    const bar = bars.find((b) => b.month === key);
    if (bar) bar.revenue += Number(p.total_amount);
  }
  return bars;
}

function buildListingStats(purchases: Purchase[]): ListingStat[] {
  const map = new Map<string, ListingStat>();
  for (const p of purchases) {
    if (!p.listing) continue;
    const existing = map.get(p.listing_id);
    if (existing) {
      existing.sales += 1;
      existing.revenue += Number(p.total_amount);
    } else {
      map.set(p.listing_id, {
        id: p.listing.id,
        title: p.listing.title,
        sales: 1,
        revenue: Number(p.total_amount),
        currency: p.currency,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

const Analytics = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    async function load() {
      try {
        const { data: myListings } = await supabase
          .from("listings")
          .select("id")
          .eq("seller_id", user!.id);

        const ids = (myListings ?? []).map((l) => l.id);
        if (ids.length === 0) { setLoading(false); return; }

        const { data, error } = await supabase
          .from("purchases")
          .select("id, total_amount, currency, paid_at, created_at, listing_id, listing:listings!inner(id, title)")
          .in("listing_id", ids)
          .eq("payment_status", "paid")
          .order("paid_at", { ascending: false });

        if (error) throw error;
        setPurchases((data ?? []) as unknown as Purchase[]);
      } catch (err) {
        captureError(err, { scope: "analytics.load" });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const currency = purchases[0]?.currency ?? "EUR";
  const totalRevenue = purchases.reduce((s, p) => s + Number(p.total_amount), 0);
  const now = new Date();
  const mtdRevenue = purchases
    .filter((p) => {
      const d = new Date(p.paid_at ?? p.created_at);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((s, p) => s + Number(p.total_amount), 0);
  const avgSale = purchases.length ? totalRevenue / purchases.length : 0;
  const monthlyBars = buildMonthlyBars(purchases);
  const listingStats = buildListingStats(purchases);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your sales performance as a seller.</p>
      </header>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total revenue", value: formatPrice(totalRevenue, currency), icon: DollarSign, hint: "All time" },
          { label: "Revenue (MTD)", value: formatPrice(mtdRevenue, currency), icon: TrendingUp, hint: "This month" },
          { label: "Total sales", value: String(purchases.length), icon: ShoppingBag, hint: "Completed purchases" },
          { label: "Avg sale value", value: formatPrice(avgSale, currency), icon: BarChart2, hint: "Per transaction" },
        ].map(({ label, value, icon: Icon, hint }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
        ))}
      </div>

      {/* ── Revenue chart ───────────────────────────────────────── */}
      <div className="mt-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-sm font-semibold text-foreground">Revenue — last 6 months</h2>
        {purchases.length === 0 ? (
          <p className="mt-8 text-center text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyBars} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${currency === "EUR" ? "€" : "$"}${v}`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [formatPrice(value, currency), "Revenue"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Top listings ────────────────────────────────────────── */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">Top listings by revenue</h2>
        </div>
        {listingStats.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium uppercase text-muted-foreground">
                <th className="px-6 py-3">Listing</th>
                <th className="px-6 py-3 text-right">Sales</th>
                <th className="px-6 py-3 text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listingStats.map((l) => (
                <tr key={l.id} className="hover:bg-muted/20">
                  <td className="px-6 py-3">
                    <Link to={`/marketplace/${l.id}`} className="font-medium text-foreground hover:text-primary">
                      {l.title}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">{l.sales}</td>
                  <td className="px-6 py-3 text-right tabular-nums font-semibold text-foreground">
                    {formatPrice(l.revenue, l.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Recent sales ────────────────────────────────────────── */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">Recent sales</h2>
        </div>
        {purchases.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {purchases.slice(0, 10).map((p) => (
              <li key={p.id} className="flex items-center justify-between px-6 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.listing?.title ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.paid_at ?? p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className="tabular-nums text-sm font-semibold text-foreground">
                  {formatPrice(Number(p.total_amount), p.currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Analytics;
