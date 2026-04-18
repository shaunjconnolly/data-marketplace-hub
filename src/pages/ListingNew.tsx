import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "@/components/listings/ListingForm";

const ListingNew = () => {
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
        New listing
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Tell buyers what's in your dataset, how it was collected, and how it's
        priced.
      </p>

      <div
        className="mt-8 rounded-2xl border border-border bg-card p-6 md:p-8"
        style={{ boxShadow: "var(--shadow-soft)" }}
      >
        <ListingForm />
      </div>
    </div>
  );
};

export default ListingNew;
