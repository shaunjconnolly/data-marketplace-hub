import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Database, Download, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatPrice, formatRecords } from "@/lib/listings";
import { captureError } from "@/lib/events";

type Listing = {
  id: string;
  title: string;
  description: string;
  category: string;
  price_per_record: number;
  total_records: number;
  currency: string;
  sample_preview: unknown;
  file_path?: string | null;
  published_at: string | null;
  seller_id: string;
};

type Purchase = {
  id: string;
  payment_status: string;
};

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [recordCount, setRecordCount] = useState<number>(1000);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data, error } = await supabase
        .from("listings")
        .select("id, title, description, category, price_per_record, total_records, currency, sample_preview, file_path, published_at, seller_id, status")
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) captureError(error, { scope: "listingDetail.load", id });
      if (!data) { setListing(null); setLoading(false); return; }
      setListing(data as Listing);
      setRecordCount(Math.min(1000, (data as Listing).total_records));
      setLoading(false);

      if (user) {
        const { data: pur } = await supabase
          .from("purchases")
          .select("id, payment_status")
          .eq("listing_id", id)
          .eq("buyer_id", user.id)
          .eq("payment_status", "paid")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (pur) setPurchase(pur as Purchase);
      }
    }
    load();
  }, [id, user]);

  const isOwner = user?.id && listing?.seller_id === user.id;

  async function confirmPurchase() {
    if (!user || !listing) return;
    const count = Math.max(1, Math.min(listing.total_records, Math.floor(recordCount || 0)));
    setPurchasing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ listing_id: listing.id, record_count: count }),
      });
      const result = await res.json();
      if (!res.ok || result.error) throw new Error(result.error ?? "Checkout failed");
      window.location.href = result.url;
    } catch (err) {
      captureError(err, { scope: "listingDetail.checkout" });
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
      setPurchasing(false);
    }
  }

  async function download() {
    if (!purchase || !listing) return;
    setDownloading(true);
    try {
      if (listing.file_path) {
        const { data, error } = await supabase.functions.invoke("dataset-download-url", { body: { purchase_id: purchase.id } });
        if (error) throw error;
        if (!data?.url) throw new Error("No download URL returned");
        window.open(data.url, "_blank", "noopener");
      } else {
        const preview = Array.isArray(listing.sample_preview) ? listing.sample_preview : [];
        const blob = new Blob([JSON.stringify(preview, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${listing.title.replace(/[^a-z0-9]/gi, "_")}_sample.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.info("Downloaded sample preview — seller has not uploaded the full file yet.");
      }
    } catch (err) {
      captureError(err, { scope: "listingDetail.download" });
      toast.error(err instanceof Error ? err.message : "Could not generate download link");
    } finally {
      setDownloading(false);
    }
  }

  function onBuyClick() {
    if (!user) {
      navigate(`/auth?next=${encodeURIComponent(`/marketplace/${listing?.id}`)}`);
      return;
    }
    setPurchaseDialogOpen(true);
  }

  const sampleRows = Array.isArray(listing?.sample_preview) ? (listing!.sample_preview as unknown[]) : [];
  const hasPaid = purchase?.payment_status === "paid";

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-foreground">
            <Database className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">WeSourceData</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/marketplace">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to marketplace
            </Link>
          </Button>
        </div>
      </nav>

      {loading ? (
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !listing ? (
        <div className="container mx-auto max-w-2xl px-6 py-20 text-center">
          <h1 className="text-2xl font-semibold text-foreground">Listing not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This listing may have been removed or isn't published.</p>
          <Button asChild className="mt-6"><Link to="/marketplace">Browse marketplace</Link></Button>
        </div>
      ) : (
        <section className="container mx-auto grid max-w-6xl gap-10 px-6 py-10 md:grid-cols-[1fr_340px] md:py-14">
          <div>
            <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              {listing.category}
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
              {listing.title}
            </h1>
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground md:text-base">
              {listing.description}
            </p>

            <div className="mt-10">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Sample preview</h2>
              {sampleRows.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  No sample provided. Purchase to access the full dataset.
                </div>
              ) : (
                <div className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
                  <pre className="max-h-96 overflow-auto p-4 text-xs leading-relaxed text-foreground">
                    {JSON.stringify(sampleRows.slice(0, 10), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Sticky purchase card */}
          <aside>
            <div className="sticky top-6 rounded-2xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Price</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                {formatPrice(listing.price_per_record, listing.currency)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/ record</span>
              </p>

              <div className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
                <Row label="Total records" value={formatRecords(listing.total_records)} />
                <Row label="Category" value={listing.category} />
                <Row label="Full dataset" value={formatPrice(listing.price_per_record * listing.total_records, listing.currency)} />
              </div>

              <div className="mt-6 space-y-2">
                {isOwner ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link to={`/dashboard/listings/${listing.id}/edit`}>Edit listing</Link>
                  </Button>
                ) : hasPaid ? (
                  <>
                    <Button onClick={download} disabled={downloading} className="w-full">
                      {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                      Download dataset
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Manage purchases at{" "}
                      <Link to="/dashboard/purchases" className="text-primary hover:underline">/dashboard/purchases</Link>.
                    </p>
                  </>
                ) : (
                  <>
                    <Button onClick={onBuyClick} className="w-full">
                      {!user && <Lock className="mr-2 h-4 w-4" />}
                      Buy now
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Secure payment via Stripe.
                    </p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </section>
      )}

      {/* Purchase dialog */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buy dataset</DialogTitle>
            <DialogDescription>
              Choose how many records you're buying. You'll be taken to Stripe to complete payment securely.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="record-count">Records</Label>
              <Input
                id="record-count"
                type="number"
                min={1}
                max={listing?.total_records ?? 1}
                step={1}
                value={recordCount}
                onChange={(e) => setRecordCount(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Up to {formatRecords(listing?.total_records ?? 0)} records available.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Price per record</span>
                <span className="font-medium text-foreground">
                  {listing ? formatPrice(listing.price_per_record, listing.currency) : "—"}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="text-foreground">Total</span>
                <span className="text-base font-semibold text-foreground">
                  {listing ? formatPrice(listing.price_per_record * Math.max(1, Math.min(listing.total_records, Math.floor(recordCount || 0))), listing.currency) : "—"}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPurchaseDialogOpen(false)} disabled={purchasing}>Cancel</Button>
            <Button onClick={confirmPurchase} disabled={purchasing}>
              {purchasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pay with Stripe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

export default ListingDetail;
