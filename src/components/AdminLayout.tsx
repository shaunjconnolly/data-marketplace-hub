import { Outlet, NavLink as RouterNavLink } from "react-router-dom";
import { ShieldCheck, Users, Database, Mail, ArrowLeft, LayoutList, Inbox, Activity, ScanSearch, Scale, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const NAV = [
  { to: "/admin", label: "Overview", icon: ShieldCheck, end: true },
  { to: "/admin/waitlist", label: "Waitlist", icon: Mail },
  { to: "/admin/listings", label: "Listings", icon: Database },
  { to: "/admin/requests", label: "Requests", icon: Inbox },
  { to: "/admin/users", label: "Users & roles", icon: Users },
  { to: "/admin/anonymisation", label: "Anonymisation", icon: ScanSearch },
  { to: "/admin/gdpr", label: "GDPR requests", icon: Scale },
  { to: "/admin/payouts", label: "Payouts", icon: Wallet },
  { to: "/admin/monitoring", label: "Monitoring", icon: Activity },
  { to: "/admin/pages", label: "Pages", icon: LayoutList },
];

export function AdminLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin console
              </p>
              <h1 className="text-base font-semibold text-foreground">
                WeSourceData
              </h1>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>
        <nav className="container mx-auto flex gap-1 overflow-x-auto px-4 pb-2">
          {NAV.map((item) => (
            <RouterNavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </RouterNavLink>
          ))}
        </nav>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
