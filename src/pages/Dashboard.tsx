import { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Database, ShoppingBag, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/listings";
import { captureError } from "@/lib/events";

type Stats = {
  activeListings: number;
  openRequests: number;
  earningsMtd: number | null;
  earningsCurrency: string;
  purchases: number;
};

const Dashboard = () => {
  const { profile, user } = useAuth();
  const name =
    profile?.display_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  const role = profile?.primary_role;
  const showSeller = role === "seller" || role === "both";
  const showBuyer = role === "buyer" || role === "both";

  const [stats, setStats] = useState<Stats>({
    activeListings: 0,
    openRequests: 0,
    earningsMtd: null,
    earningsCurrency: "EUR",
    purchases: 0,
  });

  useEffect(() => {
    if (!user) return;

    async function loadStats() {
      try {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const [{ count: activeListings }, { data: myListings }, { count: purchaseCount }] =
          await Promise.all([
            supabase
              .from("listings")
              .select("id", { count: "exact", head: true })
              .eq("seller_id", user!.id)
              .eq("status", "published"),
            supabase.from("listings").select("id").eq("seller_id", user!.id),
            supabase
              .from("purchases")
              .select("id", { count: "exact", head: true })
              .eq("buyer_id", user!.id),
          ]);

        const listingIds = (myListings ?? []).map((l) => l.id);
        let openRequests = 0;
        let earningsMtd = 0;
        let earningsCurrency = "EUR";

        if (listingIds.length > 0) {
          const [{ count: reqCount }, { data: purchases }] = await Promise.all([
            supabase
              .from("access_requests")
              .select("id", { count: "exact", head: true })
              .in("listing_id", listingIds)
              .eq("status", "pending"),
            supabase
              .from("purchases")
              .select("total_amount, currency")
              .in("listing_id", listingIds)
              .eq("payment_status", "paid")
              .gte("paid_at", monthStart.toISOString()),
          ]);

          openRequests = reqCount ?? 0;
          earningsMtd = (purchases ?? []).reduce((sum, p) => sum + Number(p.total_amount), 0);
          earningsCurrency = purchases?.[0]?.currency ?? "EUR";
        }

        setStats({
          activeListings: activeListings ?? 0,
          openRequests,
          earningsMtd,
          earningsCurrency,
          purchases: purchaseCount ?? 0,
        });
      } catch (err) {
        captureError(err, { scope: "dashboard.loadStats" });
      }
    }

    loadStats();
  }, [user]);

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Welcome back
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Hi {name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your workspace is ready. Create listings or browse the marketplace below.
        </p>
      </header>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {showSeller && (
          <>
            <StatCard
              label="Active listings"
              value={String(stats.activeListings)}
              hint="Published now"
            />
            <StatCard
              label="Open requests"
              value={String(stats.openRequests)}
              hint="Pending approval"
              to="/dashboard/requests"
            />
            <StatCard
              label="Earnings (MTD)"
              value={
                stats.earningsMtd === null
                  ? "—"
                  : formatPrice(stats.earningsMtd, stats.earningsCurrency)
              }
              hint="This month"
            />
          </>
        )}
        {showBuyer && !showSeller && (
          <StatCard
            label="Purchases"
            value={String(stats.purchases)}
            hint="Total datasets bought"
            to="/dashboard/purchases"
          />
        )}
        {role === "both" && (
          <StatCard
            label="Purchases"
            value={String(stats.purchases)}
            hint="Total datasets bought"
            to="/dashboard/purchases"
          />
        )}
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {showSeller && (
          <ActionCard
            icon={<Database className="h-5 w-5" />}
            title="Your listings"
            body="Upload a dataset to start selling. Set your price per record."
            ctaLabel="Manage listings"
            ctaTo="/dashboard/listings"
          />
        )}
        {showBuyer && (
          <ActionCard
            icon={<ShoppingBag className="h-5 w-5" />}
            title="Browse the marketplace"
            body="Find compliant datasets and request access at per-record pricing."
            ctaLabel="Open marketplace"
            ctaTo="/marketplace"
          />
        )}
        {!role && (
          <ActionCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Finish your setup"
            body="Tell us how you'll use Uber4Data so we can tailor the experience."
            ctaLabel="Complete onboarding"
            ctaTo="/onboarding"
          />
        )}
      </section>
    </div>
  );
};

function StatCard({
  label,
  value,
  hint,
  to,
}: {
  label: string;
  value: string;
  hint: string;
  to?: string;
}) {
  const content = (
    <div
      className="rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function ActionCard({
  icon,
  title,
  body,
  ctaLabel,
  ctaTo,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
}) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-6"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      <div className="mt-4">
        <Button asChild>
          <Link to={ctaTo}>{ctaLabel}</Link>
        </Button>
      </div>
    </div>
  );
}

export default Dashboard;
