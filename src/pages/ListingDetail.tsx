import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Database, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  formatPrice,
  formatRecords,
  type AccessRequestStatus,
} from "@/lib/listings";
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
  published_at: string | null;
  seller_id: string;
};

const ListingDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestStatus, setRequestStatus] =
    useState<AccessRequestStatus | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id, title, description, category, price_per_record, total_records, currency, sample_preview, published_at, seller_id, status",
        )
        .eq("id", id)
        .eq("status", "published")
        .maybeSingle();
      if (error) captureError(error, { scope: "listingDetail.load", id });
      if (!data) {
        setListing(null);
        setLoading(false);
        return;
      }
      setListing(data as Listing);
      setLoading(false);

      if (user) {
        const { data: req } = await supabase
          .from("access_requests")
          .select("status")
          .eq("listing_id", id)
          .eq("buyer_id", user.id)
          .maybeSingle();
        if (req) setRequestStatus(req.status as AccessRequestStatus);
      }
    }
    load();
  }, [id, user]);

  const isOwner = user?.id && listing?.seller_id === user.id;

  async function submitRequest() {
    if (!user || !listing) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("access_requests").insert({
        listing_id: listing.id,
        buyer_id: user.id,
        message: message.trim() || null,
      });
      if (error) throw error;
      setRequestStatus("pending");
      setDialogOpen(false);
      setMessage("");
      toast.success("Request sent to the seller");
    } catch (err) {
      captureError(err, { scope: "listingDetail.requestAccess" });
      toast.error(
        err instanceof Error ? err.message : "Could not send request",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function onCtaClick() {
    if (!user) {
      const next = encodeURIComponent(`/marketplace/${listing?.id}`);
      navigate(`/auth?next=${next}`);
      return;
    }
    if (!profile?.onboarding_completed) {
      navigate("/onboarding");
      return;
    }
    setDialogOpen(true);
  }

  const sampleRows = Array.isArray(listing?.sample_preview)
    ? (listing!.sample_preview as unknown[])
    : [];

  return (
    <main className="min-h-screen bg-background">
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-foreground">
            <Database className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Uber4Data</span>
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
          <h1 className="text-2xl font-semibold text-foreground">
            Listing not found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This listing may have been removed or isn't published.
          </p>
          <Button asChild className="mt-6">
            <Link to="/marketplace">Browse marketplace</Link>
          </Button>
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
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Sample preview
              </h2>
              {sampleRows.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  No sample provided. Request access for the full dataset
                  schema.
                </div>
              ) : (
                <div
                  className="mt-3 overflow-hidden rounded-xl border border-border bg-card"
                  style={{ boxShadow: "var(--shadow-soft)" }}
                >
                  <pre className="max-h-96 overflow-auto p-4 text-xs leading-relaxed text-foreground">
                    {JSON.stringify(sampleRows.slice(0, 10), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Sticky purchase card */}
          <aside>
            <div
              className="sticky top-6 rounded-2xl border border-border bg-card p-6"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Price
              </p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
                {formatPrice(listing.price_per_record, listing.currency)}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  / record
                </span>
              </p>

              <div className="mt-6 space-y-3 border-t border-border pt-6 text-sm">
                <Row
                  label="Total records"
                  value={formatRecords(listing.total_records)}
                />
                <Row label="Category" value={listing.category} />
                <Row
                  label="Full dataset"
                  value={formatPrice(
                    listing.price_per_record * listing.total_records,
                    listing.currency,
                  )}
                />
              </div>

              <div className="mt-6">
                {isOwner ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link to={`/dashboard/listings/${listing.id}/edit`}>
                      Edit listing
                    </Link>
                  </Button>
                ) : requestStatus ? (
                  <Button disabled className="w-full capitalize">
                    Request {requestStatus}
                  </Button>
                ) : (
                  <Button onClick={onCtaClick} className="w-full">
                    {!user && <Lock className="mr-2 h-4 w-4" />}
                    Request access
                  </Button>
                )}
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  No charge until the seller approves.
                </p>
              </div>
            </div>
          </aside>
        </section>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request access</DialogTitle>
            <DialogDescription>
              Tell the seller a bit about how you'll use this data. They'll
              review and respond.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            rows={5}
            placeholder="e.g. Building a SaaS lead-scoring model. Need 5,000 records this month."
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={submitRequest} disabled={submitting}>
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Send request
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
