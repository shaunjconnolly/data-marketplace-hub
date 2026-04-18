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
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type Role = "buyer" | "seller" | "both";

const Settings = () => {
  const { user, profile, refreshProfile } = useAuth();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [company, setCompany] = useState(profile?.company ?? "");
  const [primaryRole, setPrimaryRole] = useState<Role | "">(
    profile?.primary_role ?? "",
  );
  const [busy, setBusy] = useState(false);

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
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Profile saved");
  }

  return (
    <div className="container mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Settings
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Update your profile information.
      </p>

      <form
        onSubmit={handleSave}
        className="mt-8 space-y-5 rounded-2xl border border-border bg-card p-6"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Email</label>
          <Input value={user?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Display name
          </label>
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
          <label className="text-sm font-medium text-foreground">
            Primary role
          </label>
          <Select
            value={primaryRole}
            onValueChange={(v) => setPrimaryRole(v as Role)}
          >
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
    </div>
  );
};

export default Settings;
