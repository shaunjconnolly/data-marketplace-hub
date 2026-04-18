import { useAuth } from "@/providers/AuthProvider";
import { Database, ShoppingBag, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const { profile, user } = useAuth();
  const name =
    profile?.display_name?.split(" ")[0] || user?.email?.split("@")[0] || "there";

  const role = profile?.primary_role;
  const showSeller = role === "seller" || role === "both";
  const showBuyer = role === "buyer" || role === "both";

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
        <StatCard label="Active listings" value="0" hint="Live now" />
        <StatCard label="Open requests" value="0" hint="Live in V4" />
        <StatCard label="Earnings (MTD)" value="—" hint="Live in V9" />
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        {showSeller && (
          <ActionCard
            icon={<Database className="h-5 w-5" />}
            title="Your first listing"
            body="Upload a dataset to start selling. Anonymisation runs automatically."
            ctaLabel="List a dataset"
            ctaTo="/dashboard/listings/new"
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
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-5"
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
}

function ActionCard({
  icon,
  title,
  body,
  ctaLabel,
  ctaTo,
  disabled,
  disabledHint,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaLabel: string;
  ctaTo: string;
  disabled?: boolean;
  disabledHint?: string;
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
      <div className="mt-4 flex items-center gap-3">
        {disabled ? (
          <Button disabled>{ctaLabel}</Button>
        ) : (
          <Button asChild>
            <Link to={ctaTo}>{ctaLabel}</Link>
          </Button>
        )}
        {disabled && disabledHint && (
          <span className="text-xs text-muted-foreground">{disabledHint}</span>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
