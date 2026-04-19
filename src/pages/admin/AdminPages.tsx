import { Link } from "react-router-dom";
import {
  Globe, LogIn, LayoutDashboard, List, PlusCircle, Edit,
  ArrowLeftRight, ShoppingBag, Bell, Settings, ShieldCheck,
  Users, Database, Mail, Lock, ExternalLink, Eye, EyeOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PageEntry = {
  path: string;
  label: string;
  description: string;
  icon: React.ElementType;
  access: "public" | "auth" | "admin";
  group: string;
};

const PAGES: PageEntry[] = [
  // Public
  {
    path: "/",
    label: "Landing page",
    description: "Marketing homepage with waitlist signup, hero, and feature highlights.",
    icon: Globe,
    access: "public",
    group: "Public",
  },
  {
    path: "/marketplace",
    label: "Marketplace",
    description: "Browse all published dataset listings with search and category filters.",
    icon: Database,
    access: "public",
    group: "Public",
  },
  {
    path: "/marketplace/:id",
    label: "Listing detail",
    description: "Full dataset detail page. Buyers can request access or purchase.",
    icon: Eye,
    access: "public",
    group: "Public",
  },
  {
    path: "/auth",
    label: "Sign in / Sign up",
    description: "Authentication page. Email/password and Google OAuth supported.",
    icon: LogIn,
    access: "public",
    group: "Public",
  },
  {
    path: "/reset-password",
    label: "Reset password",
    description: "Password reset flow via email link.",
    icon: Lock,
    access: "public",
    group: "Public",
  },
  // Authenticated
  {
    path: "/onboarding",
    label: "Onboarding",
    description: "First-time setup. Collects display name, company, and primary role.",
    icon: PlusCircle,
    access: "auth",
    group: "Dashboard",
  },
  {
    path: "/dashboard",
    label: "Dashboard",
    description: "Main hub showing buyer and seller stats with quick action cards.",
    icon: LayoutDashboard,
    access: "auth",
    group: "Dashboard",
  },
  {
    path: "/dashboard/listings",
    label: "My listings",
    description: "Seller view — manage, publish, archive, and delete dataset listings.",
    icon: List,
    access: "auth",
    group: "Dashboard",
  },
  {
    path: "/dashboard/listings/new",
    label: "Create listing",
    description: "Form to create a new dataset listing with pricing and sample data.",
    icon: PlusCircle,
    access: "auth",
    group: "Dashboard",
  },
  {
    path: "/dashboard/listings/:id/edit",
    label: "Edit listing",
    description: "Edit an existing listing's details, pricing, and file.",
    icon: Edit,
    access: "auth",
    group: "Dashboard",
  },
  {
    path: "/dashboard/requests",
    label: "Access requests",
    description: "Sellers approve/decline requests. Buyers track their sent requests.",
    icon: ArrowLeftRight,
    access: "auth",
    group: "Dashboard",
  },
  {
    path: "/dashboard/purchases",
    label: "Purchases",
    description: "Buyer view — purchased datasets with time-limited download links.",
    icon: ShoppingBag,
    access: "auth",
    group: "Dashboard",
  },
  {
    path: "/dashboard/notifications",
    label: "Notifications",
    description: "Inbox for access approvals, declines, and platform events.",
    icon: Bell,
    access: "auth",
    group: "Dashboard",
  },
  {
    path: "/dashboard/settings",
    label: "Settings",
    description: "Profile settings and GDPR data rights (export, erasure).",
    icon: Settings,
    access: "auth",
    group: "Dashboard",
  },
  // Admin
  {
    path: "/admin",
    label: "Admin overview",
    description: "Live platform metrics — waitlist, listings, and user counts.",
    icon: ShieldCheck,
    access: "admin",
    group: "Admin",
  },
  {
    path: "/admin/waitlist",
    label: "Waitlist",
    description: "Manage waitlist entries. Mark as invited or converted.",
    icon: Mail,
    access: "admin",
    group: "Admin",
  },
  {
    path: "/admin/listings",
    label: "All listings",
    description: "View and moderate every listing across the platform.",
    icon: Database,
    access: "admin",
    group: "Admin",
  },
  {
    path: "/admin/users",
    label: "Users & roles",
    description: "Assign and revoke admin / moderator roles.",
    icon: Users,
    access: "admin",
    group: "Admin",
  },
  {
    path: "/admin/pages",
    label: "Page repository",
    description: "This page — a full directory of every route in the application.",
    icon: EyeOff,
    access: "admin",
    group: "Admin",
  },
];

const ACCESS_BADGE: Record<PageEntry["access"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  public: { label: "Public", variant: "secondary" },
  auth: { label: "Auth required", variant: "outline" },
  admin: { label: "Admin only", variant: "default" },
};

const GROUPS = ["Public", "Dashboard", "Admin"];

const AdminPages = () => {
  const grouped = GROUPS.map((g) => ({
    group: g,
    pages: PAGES.filter((p) => p.group === g),
  }));

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Page repository
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every route in the Uber4Data application — {PAGES.length} pages across {GROUPS.length} access levels.
      </p>

      <div className="mt-8 space-y-10">
        {grouped.map(({ group, pages }) => (
          <section key={group}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {group}
            </h2>
            <div className="overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-soft)" }}>
              {pages.map((page, i) => {
                const isParam = page.path.includes(":");
                const badge = ACCESS_BADGE[page.access];
                return (
                  <div
                    key={page.path}
                    className={`flex items-start gap-4 px-5 py-4 ${i < pages.length - 1 ? "border-b border-border" : ""}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <page.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{page.label}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {page.path}
                        </code>
                        <Badge variant={badge.variant} className="text-xs">
                          {badge.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {page.description}
                      </p>
                    </div>
                    {!isParam && (
                      <Link
                        to={page.path}
                        target={page.access === "admin" ? undefined : "_blank"}
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                        title={`Open ${page.label}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default AdminPages;
