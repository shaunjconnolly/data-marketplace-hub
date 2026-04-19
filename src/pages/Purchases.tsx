import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Loader2, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatPrice, formatRecords } from "@/lib/listings";
import { captureError } from "@/lib/events";

type Row = {
  id: string;
  created_at: string;
  paid_at: string | null;
  payment_status: string;
  total_amount: number;
  record_count: number;
  price_per_record: number;
  currency: string;
  listing: {
    id: string;
    title: string;
    category: string;
    file_path: string | null;
    file_original_name: string | null;
  } | null;
};

const Purchases = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data, error } = await supabase
        .from("purchases")
        .select(
          "id, created_at, paid_at, payment_status, total_amount, record_count, price_per_record, currency, listing:listings!inner(id, title, category, file_path, file_original_name)",
        )
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });
      if (error) {
        captureError(error, { scope: "purchases.load" });
        toast.error("Could not load your purchases");
      }
      setRows((data ?? []) as unknown as Row[]);
      setLoading(false);
    }
    load();
  }, [user]);

  async function download(purchaseId: string) {
    setDownloadingId(purchaseId);
    try {
      const { data, error } = await supabase.functions.invoke(
        "dataset-download-url",
        { body: { purchase_id: purchaseId } },
      );
      if (error) throw error;
      if (!data?.url) throw new Error("No download URL returned");
      window.open(data.url, "_blank", "noopener");
    } catch (err) {
      captureError(err, { scope: "purchases.download", purchaseId });
      toast.error(
        err instanceof Error ? err.message : "Could not generate download link",
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Purchases
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Datasets you've bought. Download links are valid for 24&nbsp;hours.
          </p>
        </div>
      </div>

      <div
        className="mt-8 overflow-hidden rounded-2xl border border-border bg-card"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-base font-semibold text-foreground">
              No purchases yet
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Browse the marketplace, request access from a seller, then
              confirm purchase to download the dataset here.
            </p>
            <Button asChild className="mt-6">
              <Link to="/marketplace">Browse marketplace</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => {
              const hasFile = !!r.listing?.file_path;
              return (
                <li
                  key={r.id}
                  className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/marketplace/${r.listing?.id ?? ""}`}
                      className="truncate text-sm font-medium text-foreground hover:text-primary"
                    >
                      {r.listing?.title ?? "Listing removed"}
                    </Link>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.listing?.category ?? "—"} ·{" "}
                      {formatRecords(r.record_count)} records ·{" "}
                      {formatPrice(r.total_amount, r.currency)} ·{" "}
                      {new Date(r.paid_at ?? r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-medium capitalize text-accent-foreground">
                      {r.payment_status}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => download(r.id)}
                      disabled={
                        !hasFile ||
                        r.payment_status !== "paid" ||
                        downloadingId === r.id
                      }
                    >
                      {downloadingId === r.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      {hasFile ? "Download" : "No file"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Purchases;
