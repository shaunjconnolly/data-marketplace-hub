import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Search, Archive, ExternalLink } from "lucide-react";
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
import {
  formatPrice,
  formatRecords,
  statusBadgeClass,
  type ListingStatus,
} from "@/lib/listings";
import { captureError } from "@/lib/events";

type Row = {
  id: string;
  title: string;
  category: string;
  price_per_record: number;
  total_records: number;
  currency: string;
  status: ListingStatus;
  seller_id: string;
  created_at: string;
  seller?: { display_name: string | null; company: string | null } | null;
};

const AdminListings = () => {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [archiving, setArchiving] = useState<Row | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, title, category, price_per_record, total_records, currency, status, seller_id, created_at",
      )
      .order("created_at", { ascending: false });
    if (error) {
      captureError(error, { scope: "admin.listings.load" });
      toast.error("Could not load listings");
      setRows([]);
      return;
    }
    const list = (data ?? []) as Row[];

    // Hydrate seller info (admin can read all profiles)
    const ids = Array.from(new Set(list.map((l) => l.seller_id)));
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, company")
        .in("id", ids);
      const map = new Map(
        (profiles ?? []).map((p) => [p.id, p as { id: string } & Row["seller"]]),
      );
      for (const row of list) {
        row.seller = map.get(row.seller_id) ?? null;
      }
    }
    setRows(list);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !(r.seller?.company ?? "").toLowerCase().includes(q) &&
        !(r.seller?.display_name ?? "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  async function confirmArchive() {
    if (!archiving) return;
    const id = archiving.id;
    setArchiving(null);
    const { error } = await supabase
      .from("listings")
      .update({ status: "archived" })
      .eq("id", id);
    if (error) {
      captureError(error, { scope: "admin.listings.archive" });
      toast.error("Could not archive listing");
      return;
    }
    toast.success("Listing archived");
    setRows((r) =>
      r?.map((row) =>
        row.id === id ? { ...row, status: "archived" as const } : row,
      ) ?? null,
    );
  }

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          All listings
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {rows === null
            ? "Loading…"
            : `${filtered.length} of ${rows.length} listings`}
        </p>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or seller…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
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
            No listings match.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">
                    {r.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>
                      {r.seller?.display_name || "—"}
                    </div>
                    {r.seller?.company && (
                      <div className="text-xs">{r.seller.company}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.category}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatRecords(r.total_records)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatPrice(r.price_per_record, r.currency)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.status === "published" && (
                        <Button asChild variant="ghost" size="icon" title="View">
                          <Link to={`/marketplace/${r.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                      )}
                      {r.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Archive"
                          onClick={() => setArchiving(r)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog
        open={!!archiving}
        onOpenChange={(o) => !o && setArchiving(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiving?.title} will be hidden from the marketplace. The seller
              can still see it in their dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminListings;
