import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShoppingCart, Store, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";

type Role = "buyer" | "seller" | "both";

const schema = z.object({
  displayName: z.string().min(1, "Tell us your name").max(100),
  company: z.string().max(200).optional(),
  primaryRole: z.enum(["buyer", "seller", "both"], {
    message: "Choose how you'll use Uber4Data",
  }),
});

const ROLE_OPTIONS: {
  value: Role;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    value: "buyer",
    title: "Buy data",
    description: "Discover and purchase compliant datasets.",
    icon: ShoppingCart,
  },
  {
    value: "seller",
    title: "Sell data",
    description: "List datasets and earn per record sold.",
    icon: Store,
  },
  {
    value: "both",
    title: "Both",
    description: "Buy and sell in the same workspace.",
    icon: Repeat,
  },
];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [primaryRole, setPrimaryRole] = useState<Role | "">("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth", { replace: true });
    if (profile?.onboarding_completed) navigate("/dashboard", { replace: true });
    if (profile) {
      setDisplayName(profile.display_name ?? "");
      setCompany(profile.company ?? "");
      if (profile.primary_role) setPrimaryRole(profile.primary_role);
    }
  }, [user, profile, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ displayName, company, primaryRole });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (!user) return;

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.displayName,
        company: parsed.data.company || null,
        primary_role: parsed.data.primaryRole,
        onboarding_completed: true,
      })
      .eq("id", user.id);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("You're all set");
    navigate("/dashboard", { replace: true });
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "var(--gradient-soft)" }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-8"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Welcome
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Tell us a bit about you
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Takes 30 seconds. You can change this anytime.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Display name
              </label>
              <Input
                required
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Company <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                placeholder="Acme Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={200}
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">
              How will you use Uber4Data?
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {ROLE_OPTIONS.map((opt) => {
                const active = primaryRole === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPrimaryRole(opt.value)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all",
                      active
                        ? "border-primary bg-accent ring-2 ring-primary/20"
                        : "border-border bg-card hover:border-primary/40",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent text-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-foreground">
                      {opt.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {opt.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Enter your dashboard"
            )}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default Onboarding;
