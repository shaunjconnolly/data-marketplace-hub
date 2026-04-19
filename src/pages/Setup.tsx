import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

const Setup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [blocked, setBlocked] = useState<boolean | null>(null);

  useEffect(() => {
    supabase
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .then(({ count }) => setBlocked((count ?? 0) > 0));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setBusy(true);

    // 1. Sign up
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      toast.error(signUpError.message);
      setBusy(false);
      return;
    }

    // 2. Sign in immediately to get a confirmed session and real user ID
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.user) {
      toast.error("Account created — check your email to confirm it, then sign in at /auth and contact support to grant admin access.");
      setBusy(false);
      return;
    }

    const userId = signInData.user.id;

    // 3. Create profile
    await supabase.from("profiles").upsert({
      id: userId,
      display_name: "Admin",
      onboarding_completed: true,
      primary_role: "both",
    });

    // 4. Grant admin role via security-definer function (bypasses RLS)
    const { error: roleError } = await supabase.rpc("setup_first_admin", {
      target_user_id: userId,
    });

    setBusy(false);

    if (roleError) {
      toast.error("Account created but admin role failed: " + roleError.message);
      return;
    }

    setDone(true);
    toast.success("Admin account created!");
  }

  if (blocked === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (blocked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Setup already complete</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An admin account already exists. Sign in to continue.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate("/auth")}>
            Go to sign in
          </Button>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-xl font-semibold text-foreground">Admin account created</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with <strong>{email}</strong> to access the admin panel.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate("/auth")}>
            Go to sign in
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Create admin account</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          First-time setup. Creates a user with full admin access.
        </p>

        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input
              type="email"
              required
              placeholder="admin@wesourcedata.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Password</label>
            <Input
              type="password"
              required
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create admin account"}
          </Button>
        </form>
      </div>
    </main>
  );
};

export default Setup;
