import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Database, Mail, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { captureError } from "@/lib/events";

type Counts = {
  waitingCount: number;
  invitedCount: number;
  publishedListings: number;
  draftListings: number;
  totalUsers: number;
  totalAdmins: number;
};

const AdminOverview = () => {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [waiting, invited, published, draft, users, admins] =
          await Promise.all([
            supabase
              .from("waitlist")
              .select("id", { count: "exact", head: true })
              .eq("status", "waiting"),
            supabase
              .from("waitlist")
              .select("id", { count: "exact", head: true })
              .eq("status", "invited"),
            supabase
              .from("listings")
              .select("id", { count: "exact", head: true })
              .eq("status", "published"),
            supabase
              .from("listings")
              .select("id", { count: "exact", head: true })
              .eq("status", "draft"),
            supabase
              .from("profiles")
              .select("id", { count: "exact", head: true }),
            supabase
              .from("user_roles")
              .select("id", { count: "exact", head: true })
              .eq("role", "admin"),
          ]);
        setCounts({
          waitingCount: waiting.count ?? 0,
          invitedCount: invited.count ?? 0,
          publishedListings: published.count ?? 0,
          draftListings: draft.count ?? 0,
          totalUsers: users.count ?? 0,
          totalAdmins: admins.count ?? 0,
        });
      } catch (err) {
        captureError(err, { scope: "admin.overview" });
      }
    }
    load();
  }, []);

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Overview
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Live snapshot of the Uber4Data platform.
      </p>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card
          icon={<Mail className="h-5 w-5" />}
          title="Waitlist"
          rows={[
            { label: "Waiting", value: counts?.waitingCount ?? "—" },
            { label: "Invited", value: counts?.invitedCount ?? "—" },
          ]}
          to="/admin/waitlist"
        />
        <Card
          icon={<Database className="h-5 w-5" />}
          title="Listings"
          rows={[
            { label: "Published", value: counts?.publishedListings ?? "—" },
            { label: "Draft", value: counts?.draftListings ?? "—" },
          ]}
          to="/admin/listings"
        />
        <Card
          icon={<Users className="h-5 w-5" />}
          title="Users"
          rows={[
            { label: "Total", value: counts?.totalUsers ?? "—" },
            { label: "Admins", value: counts?.totalAdmins ?? "—" },
          ]}
          to="/admin/users"
        />
      </section>

      <section
        className="mt-10 rounded-2xl border border-border bg-card p-6"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Admin access
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You are signed in as an admin. Actions taken here affect every
              user on Uber4Data — be careful, especially when archiving
              listings or revoking roles.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

function Card({
  icon,
  title,
  rows,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  rows: { label: string; value: number | string }[];
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group block rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-semibold uppercase tracking-wider">
          {title}
        </p>
      </div>
      <dl className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between">
            <dt className="text-sm text-muted-foreground">{r.label}</dt>
            <dd className="text-2xl font-semibold tracking-tight text-foreground">
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

export default AdminOverview;
