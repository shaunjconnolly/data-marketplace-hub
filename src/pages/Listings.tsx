import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
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
  created_at: string;
};

const Listings = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);

  async function load() {
    if (!user) return;
    const { data, error } = await supabase
      .from("listings")
      .select(
        "id, title, category, price_per_record, total_records, currency, status, created_at",
      )
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      captureError(error, { scope: "listings.load" });
      toast.error("Could not load listings");
      setRows([]);
      return;
    }
    setRows((data ?? []) as Row[]);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function confirmDelete() {
    if (!deleting) return;
    const id = deleting.id;
    setDeleting(null);
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) {
      captureError(error, { scope: "listings.delete" });
      toast.error("Could not delete listing");
      return;
    }
    toast.success("Listing deleted");
    setRows((r) => r?.filter((x) => x.id !== id) ?? null);
  }

  return (
    <div className="container mx-auto max-w-6xl px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            My listings
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create and manage the datasets you sell on WeSourceData.
          </p>
        </div>
        <Button asChild>
          <Link to="/dashboard/listings/new">
            <Plus className="mr-2 h-4 w-4" />
            New listing
          </Link>
        </Button>
      </header>

      <div
        className="mt-8 overflow-hidden rounded-2xl border border-border bg-card"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        {rows === null ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead className="text-right">Price / record</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">
                    {r.title}
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
                      <Button asChild variant="ghost" size="icon" title="Edit">
                        <Link to={`/dashboard/listings/${r.id}/edit`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Delete"
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this listing?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.title} will be permanently removed. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

function EmptyState() {
  return (
    <div className="px-6 py-16 text-center">
      <h3 className="text-base font-semibold text-foreground">
        No listings yet
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Create your first listing to start selling. You can save it as a draft
        and publish when you're ready.
      </p>
      <Button asChild className="mt-6">
        <Link to="/dashboard/listings/new">
          <Plus className="mr-2 h-4 w-4" />
          Create listing
        </Link>
      </Button>
    </div>
  );
}

export default Listings;
