import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { captureError } from "@/lib/events";

type Row = {
  id: string;
  email: string;
  role: string | null;
  company: string | null;
  source: string | null;
  status: string;
  created_at: string;
};

const STATUSES = ["waiting", "invited", "converted"] as const;

function badgeClass(status: string) {
  switch (status) {
    case "invited":
      return "bg-accent text-accent-foreground";
    case "converted":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
}

const AdminWaitlist = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("waitlist")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      captureError(error, { scope: "admin.waitlist.load" });
      toast.error("Could not load waitlist");
      setRows([]);
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("admin-waitlist")
      .on("postgres_changes", { event: "*", schema: "public", table: "waitlist" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (
        q &&
        !r.email.toLowerCase().includes(q) &&
        !(r.company ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  function exportCsv() {
    const cols = ["email", "company", "role", "source", "status", "created_at"] as const;
    const header = cols.join(",");
    const escape = (v: string | null) =>
      v == null ? "" : `"${v.replace(/"/g, '""')}"`;
    const body = filtered
      .map((r) => cols.map((c) => escape(r[c] ?? null)).join(","))
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function setStatus(id: string, status: string) {
    setUpdating(id);
    const { error } = await supabase
      .from("waitlist")
      .update({ status })
      .eq("id", id);
    setUpdating(null);
    if (error) {
      captureError(error, { scope: "admin.waitlist.update" });
      toast.error("Could not update status");
      return;
    }
    toast.success(`Marked as ${status}`);
    setRows(
      (r) =>
        r?.map((row) => (row.id === id ? { ...row, status } : row)) ?? null,
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Waitlist
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rows === null
            ? "Loading…"
            : `${filtered.length} of ${rows.length} entries`}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          disabled={!filtered.length}
          onClick={exportCsv}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV ({filtered.length})
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email or company…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className="mt-6 overflow-hidden rounded-2xl border border-border bg-card"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        {rows === null ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            No entries match.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">
                    {r.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.company || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.role || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.source || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badgeClass(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "waiting" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating === r.id}
                        onClick={() => setStatus(r.id, "invited")}
                      >
                        {updating === r.id && (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        )}
                        Mark invited
                      </Button>
                    )}
                    {r.status === "invited" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updating === r.id}
                        onClick={() => setStatus(r.id, "converted")}
                      >
                        {updating === r.id && (
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        )}
                        Mark converted
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default AdminWaitlist;
