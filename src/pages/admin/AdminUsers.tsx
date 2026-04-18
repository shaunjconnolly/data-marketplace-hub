import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { captureError } from "@/lib/events";

type Profile = {
  id: string;
  display_name: string | null;
  company: string | null;
  primary_role: string | null;
  onboarding_completed: boolean;
  created_at: string;
};

type RoleRow = { user_id: string; role: "admin" | "moderator" | "user" };

const AdminUsers = () => {
  const { user: me } = useAuth();
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<{
    profile: Profile;
    action: "grant" | "revoke";
  } | null>(null);
  const [working, setWorking] = useState(false);

  async function load() {
    const [{ data: profilesData, error: pErr }, { data: rolesData }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, display_name, company, primary_role, onboarding_completed, created_at",
          )
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
    if (pErr) {
      captureError(pErr, { scope: "admin.users.load" });
      toast.error("Could not load users");
      setProfiles([]);
      return;
    }
    setProfiles((profilesData ?? []) as Profile[]);
    setRoles((rolesData ?? []) as RoleRow[]);
  }

  useEffect(() => {
    load();
  }, []);

  const adminIds = useMemo(
    () => new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id)),
    [roles],
  );

  const filtered = useMemo(() => {
    if (!profiles) return [];
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(
      (p) =>
        (p.display_name ?? "").toLowerCase().includes(q) ||
        (p.company ?? "").toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [profiles, search]);

  async function applyRoleChange() {
    if (!pending) return;
    setWorking(true);
    try {
      if (pending.action === "grant") {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: pending.profile.id, role: "admin" });
        if (error) throw error;
        setRoles((r) => [
          ...r,
          { user_id: pending.profile.id, role: "admin" },
        ]);
        toast.success("Admin role granted");
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", pending.profile.id)
          .eq("role", "admin");
        if (error) throw error;
        setRoles((r) =>
          r.filter(
            (x) => !(x.user_id === pending.profile.id && x.role === "admin"),
          ),
        );
        toast.success("Admin role revoked");
      }
    } catch (err) {
      captureError(err, { scope: "admin.users.role" });
      toast.error(
        err instanceof Error ? err.message : "Could not update role",
      );
    } finally {
      setWorking(false);
      setPending(null);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Users & roles
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {profiles === null
            ? "Loading…"
            : `${filtered.length} of ${profiles.length} users`}
        </p>
      </header>

      <div className="mt-6">
        <div className="relative max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, or id…"
            className="pl-9"
          />
        </div>
      </div>

      <div
        className="mt-6 overflow-hidden rounded-2xl border border-border bg-card"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        {profiles === null ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No users match.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Onboarded</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Admin access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const isAdmin = adminIds.has(p.id);
                const isMe = p.id === me?.id;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-foreground">
                      {p.display_name || "—"}
                      {isMe && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.company || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground capitalize">
                      {p.primary_role || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.onboarding_completed ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isMe}
                          onClick={() =>
                            setPending({ profile: p, action: "revoke" })
                          }
                        >
                          <ShieldOff className="mr-2 h-3.5 w-3.5" />
                          Revoke admin
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            setPending({ profile: p, action: "grant" })
                          }
                        >
                          <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                          Make admin
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.action === "grant"
                ? "Grant admin role?"
                : "Revoke admin role?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.action === "grant"
                ? `${pending?.profile.display_name || "This user"} will get full admin access, including the ability to grant and revoke roles.`
                : `${pending?.profile.display_name || "This user"} will lose admin access immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyRoleChange} disabled={working}>
              {working && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending?.action === "grant" ? "Grant admin" : "Revoke admin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
