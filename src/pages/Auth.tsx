import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Database, Loader2, Mail } from "lucide-react";

const signInSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const signUpSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
  displayName: z.string().min(1, "Required").max(100).optional().or(z.literal("")),
});

const resetSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/dashboard";
  const { user, loading: authLoading } = useAuth();

  // Redirect if already signed in
  useEffect(() => {
    if (!authLoading && user) navigate(next, { replace: true });
  }, [user, authLoading, navigate, next]);

  const [tab, setTab] = useState<"sign-in" | "sign-up" | "reset">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signInSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Welcome back");
    navigate(next, { replace: true });
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin + next,
        data: parsed.data.displayName
          ? { display_name: parsed.data.displayName }
          : undefined,
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setVerificationSent(true);
    toast.success("Check your inbox to verify your email");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    const parsed = resetSchema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset email sent");
    setTab("sign-in");
  }

  if (verificationSent) {
    return (
      <CenteredCard>
        <Mail className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">
          Check your email
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a verification link to <strong>{email}</strong>. Click it to
          activate your account.
        </p>
        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={() => {
            setVerificationSent(false);
            setTab("sign-in");
          }}
        >
          Back to sign in
        </Button>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard>
      <Link to="/" className="flex items-center justify-center gap-2 text-foreground">
        <Database className="h-5 w-5 text-primary" />
        <span className="font-semibold">Uber4Data</span>
      </Link>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as typeof tab)}
        className="mt-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sign-in">Sign in</TabsTrigger>
          <TabsTrigger value="sign-up">Create account</TabsTrigger>
        </TabsList>

        <TabsContent value="sign-in" className="mt-6 space-y-4">
          <form onSubmit={handleSignIn} className="space-y-3">
            <FieldEmail value={email} onChange={setEmail} />
            <FieldPassword value={password} onChange={setPassword} />
            <div className="flex justify-end">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setTab("reset")}
              >
                Forgot password?
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="sign-up" className="mt-6 space-y-4">
          <form onSubmit={handleSignUp} className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Your name <span className="text-muted-foreground">(optional)</span>
              </label>
              <Input
                type="text"
                placeholder="Jane Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                maxLength={100}
              />
            </div>
            <FieldEmail value={email} onChange={setEmail} />
            <FieldPassword
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              hint="At least 8 characters"
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              By signing up you agree to our terms of service.
            </p>
          </form>
        </TabsContent>

        {tab === "reset" && (
          <div className="mt-6 space-y-4">
            <h2 className="text-lg font-semibold text-foreground">
              Reset your password
            </h2>
            <p className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a reset link.
            </p>
            <form onSubmit={handleReset} className="space-y-3">
              <FieldEmail value={email} onChange={setEmail} />
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Send reset link"
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setTab("sign-in")}
              >
                Back to sign in
              </Button>
            </form>
          </div>
        )}
      </Tabs>
    </CenteredCard>
  );
};

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "var(--gradient-soft)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-8"
        style={{ boxShadow: "var(--shadow-elegant)" }}
      >
        {children}
      </div>
    </main>
  );
}

function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">{children}</span>
      </div>
    </div>
  );
}

function FieldEmail({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Email</label>
      <Input
        type="email"
        required
        placeholder="you@company.com"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="email"
      />
    </div>
  );
}

function FieldPassword({
  value,
  onChange,
  autoComplete = "current-password",
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Password</label>
      <Input
        type="password"
        required
        placeholder="••••••••"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.07.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export default Auth;
