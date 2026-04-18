import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { waitlistSchema } from "@/validation/waitlist";
import { CheckCircle2, UserCheck2, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error" | "duplicate";
type Role = "buyer" | "seller" | "both";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [company, setCompany] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");

    const parsed = waitlistSchema.safeParse({
      email,
      role: role || undefined,
      company: company || undefined,
    });
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Invalid input");
      setStatus("error");
      return;
    }

    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("waitlist-join", {
        body: parsed.data,
      });

      if (error) {
        // FunctionsHttpError carries the response — try to extract our payload
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          try {
            const body = await ctx.json();
            if (ctx.status === 409) {
              setStatus("duplicate");
              return;
            }
            setErrorMessage(body?.error ?? "Something went wrong.");
            setStatus("error");
            return;
          } catch {
            // fall through
          }
        }
        setErrorMessage(error.message ?? "Something went wrong.");
        setStatus("error");
        return;
      }

      if (data?.ok) {
        setStatus("success");
      } else {
        setErrorMessage(data?.error ?? "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
        <h3 className="mt-4 text-xl font-semibold text-foreground">
          You&apos;re on the list
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          We&apos;ll be in touch when early access opens.
        </p>
      </div>
    );
  }

  if (status === "duplicate") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <UserCheck2 className="mx-auto h-12 w-12 text-primary" />
        <h3 className="mt-4 text-xl font-semibold text-foreground">
          Already registered
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This email is already on the waitlist. We&apos;ll be in touch soon.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-border bg-card p-6 shadow-sm"
    >
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Work email
        </label>
        <Input
          id="email"
          type="email"
          required
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          I want to <span className="text-muted-foreground">(optional)</span>
        </label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buyer">Buy data</SelectItem>
            <SelectItem value="seller">Sell data</SelectItem>
            <SelectItem value="both">Buy and sell</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label htmlFor="company" className="text-sm font-medium text-foreground">
          Company <span className="text-muted-foreground">(optional)</span>
        </label>
        <Input
          id="company"
          type="text"
          placeholder="Acme Inc."
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          autoComplete="organization"
        />
      </div>

      {status === "error" && errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={status === "loading"}>
        {status === "loading" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Joining…
          </>
        ) : (
          "Join the waitlist"
        )}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        No spam. We&apos;ll only email you about early access.
      </p>
    </form>
  );
}
