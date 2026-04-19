import { useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Download, Trash2, ShieldCheck, Smartphone } from "lucide-react";

type Role = "buyer" | "seller" | "both";

const Settings = () => {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [company, setCompany] = useState(profile?.company ?? "");
  const [primaryRole, setPrimaryRole] = useState<Role | "">(
    profile?.primary_role ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [dsrBusy, setDsrBusy] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !primaryRole) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        company: company || null,
        primary_role: primaryRole,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    await refreshProfile();
    toast.success("Profile saved");
  }

  async function requestExport() {
    if (!user) return;
    setDsrBusy(true);
    const { error } = await supabase.from("data_subject_requests").insert({
      user_id: user.id,
      email: user.email!,
      request_type: "export",
    });
    setDsrBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Data export request submitted. We'll email you within 30 days.");
  }

  async function requestErasure() {
    if (!user) return;
    setDsrBusy(true);
    const { error } = await supabase.from("data_subject_requests").insert({
      user_id: user.id,
      email: user.email!,
      request_type: "erasure",
    });
    setDsrBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Account deletion request submitted. We'll process it within 30 days.");
    await signOut();
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-8 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your profile information.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-5 rounded-2xl border border-border bg-card p-6"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email</label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Display name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={100}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Company</label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Primary role</label>
          <Select value={primaryRole} onValueChange={(v) => setPrimaryRole(v as Role)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="buyer">Buyer</SelectItem>
              <SelectItem value="seller">Seller</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
        </Button>
      </form>

      {/* Two-factor authentication */}
      <div className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Two-factor authentication</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a second layer of security to your account using an authenticator app.
        </p>
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-muted/30 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Authenticator app (TOTP)</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Use Google Authenticator, Authy, or any TOTP-compatible app.
            </p>
          </div>
          <Button variant="outline" size="sm" disabled onClick={() => toast.info("2FA setup coming soon")}>
            Set up
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          2FA enforcement is coming in a future update. All sellers will be required to enable it.
        </p>
      </div>

      {/* GDPR / Privacy rights */}
      <div className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-soft)" }}>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold text-foreground">Your data rights</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          WeSourceData is operated from Ireland and Belgium and is subject to GDPR.
          You have the right to access, export, or erase your personal data at any time.
        </p>

        <div className="mt-5 space-y-3">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Export my data</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Request a copy of all personal data we hold about you (Art. 20 GDPR).
                We'll email it to you within 30 days.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={requestExport}
              disabled={dsrBusy}
              className="shrink-0"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Request export
            </Button>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-destructive/30 p-4">
            <div>
              <p className="text-sm font-medium text-foreground">Delete my account</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Permanently erase your account and all associated personal data (Art. 17 GDPR).
                This cannot be undone.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={dsrBusy}
                  className="shrink-0"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This submits a GDPR erasure request. Your account will be
                    deactivated immediately and all personal data permanently
                    deleted within 30 days. Active listings and purchases will
                    also be removed. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={requestErasure}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          For other requests (rectification, restriction of processing) email{" "}
          <a href="mailto:privacy@wesourcedata.com" className="underline underline-offset-2">
            privacy@wesourcedata.com
          </a>
        </p>
      </div>
    </div>
  );
};

export default Settings;
