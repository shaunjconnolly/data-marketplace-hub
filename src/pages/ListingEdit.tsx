import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { ListingForm } from "@/components/listings/ListingForm";
import { toast } from "sonner";
import { captureError } from "@/lib/events";
import type { ListingStatus } from "@/lib/listings";

type Loaded = {
  id: string;
  title: string;
  description: string;
  category: string;
  price_per_record: number;
  total_records: number;
  sample_preview: unknown;
  status: ListingStatus;
  file_path: string | null;
  file_size_bytes: number | null;
  file_mime: string | null;
  file_original_name: string | null;
};

const ListingEdit = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [listing, setListing] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!id || !user) return;
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id, title, description, category, price_per_record, total_records, sample_preview, status, seller_id, file_path, file_size_bytes, file_mime, file_original_name",
        )
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        captureError(error, { scope: "listingEdit.load", id });
        toast.error("Listing not found");
        navigate("/dashboard/listings");
        return;
      }
      if (data.seller_id !== user.id) {
        toast.error("You can only edit your own listings");
        navigate("/dashboard/listings");
        return;
      }
      setListing(data as Loaded);
      setLoading(false);
    }
    load();
  }, [id, user, navigate]);

  return (
    <div className="container mx-auto max-w-3xl px-6 py-10">
      <Link
        to="/dashboard/listings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        Edit listing
      </h1>

      <div
        className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        {loading || !listing ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ListingForm initial={listing} />
        )}
      </div>
    </div>
  );
};

export default ListingEdit;
