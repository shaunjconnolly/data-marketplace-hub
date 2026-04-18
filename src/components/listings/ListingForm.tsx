import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  listingSchema,
  parseSamplePreview,
  type ListingFormValues,
} from "@/validation/listing";
import { LISTING_CATEGORIES, type ListingStatus } from "@/lib/listings";
import { captureError } from "@/lib/events";

type Props = {
  initial?: Partial<ListingFormValues> & {
    id?: string;
    status?: ListingStatus;
    sample_preview?: unknown;
  };
};

export function ListingForm({ initial }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!initial?.id;

  const [values, setValues] = useState<ListingFormValues>({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    category: (initial?.category as ListingFormValues["category"]) ?? "",
    price_per_record: initial?.price_per_record ?? 0.01,
    total_records: initial?.total_records ?? 1000,
    sample_preview_text: initial?.sample_preview
      ? JSON.stringify(initial.sample_preview, null, 2)
      : "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<null | "draft" | "published">(
    null,
  );

  function update<K extends keyof ListingFormValues>(
    key: K,
    value: ListingFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function submit(targetStatus: "draft" | "published") {
    if (!user) return;
    const parsed = listingSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSubmitting(targetStatus);
    try {
      const sample = parseSamplePreview(parsed.data.sample_preview_text);
      const payload = {
        title: parsed.data.title,
        description: parsed.data.description,
        category: parsed.data.category,
        price_per_record: parsed.data.price_per_record,
        total_records: parsed.data.total_records,
        sample_preview: sample,
        status: targetStatus,
        published_at: targetStatus === "published" ? new Date().toISOString() : null,
        seller_id: user.id,
      };

      if (isEditing && initial?.id) {
        const { error } = await supabase
          .from("listings")
          .update(payload)
          .eq("id", initial.id);
        if (error) throw error;
        toast.success(
          targetStatus === "published" ? "Listing published" : "Draft saved",
        );
      } else {
        const { error } = await supabase.from("listings").insert(payload);
        if (error) throw error;
        toast.success(
          targetStatus === "published" ? "Listing published" : "Draft saved",
        );
      }
      navigate("/dashboard/listings");
    } catch (err) {
      captureError(err, { scope: "listing.save", targetStatus });
      toast.error(
        err instanceof Error ? err.message : "Could not save listing",
      );
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit("published");
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={values.title}
          maxLength={120}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. EU SaaS company contacts (verified, 2025)"
        />
        {errors.title && (
          <p className="text-sm text-destructive">{errors.title}</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select
            value={values.category}
            onValueChange={(v) =>
              update("category", v as ListingFormValues["category"])
            }
          >
            <SelectTrigger id="category">
              <SelectValue placeholder="Pick a category" />
            </SelectTrigger>
            <SelectContent>
              {LISTING_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_records">Total records</Label>
          <Input
            id="total_records"
            type="number"
            min={1}
            step={1}
            value={values.total_records}
            onChange={(e) =>
              update("total_records", Number(e.target.value) as never)
            }
          />
          {errors.total_records && (
            <p className="text-sm text-destructive">{errors.total_records}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="price">Price per record (USD)</Label>
        <Input
          id="price"
          type="number"
          min={0}
          step="0.0001"
          value={values.price_per_record}
          onChange={(e) =>
            update("price_per_record", Number(e.target.value) as never)
          }
        />
        <p className="text-xs text-muted-foreground">
          Buyers pay this amount per record they unlock.
        </p>
        {errors.price_per_record && (
          <p className="text-sm text-destructive">{errors.price_per_record}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={6}
          value={values.description}
          maxLength={4000}
          onChange={(e) => update("description", e.target.value)}
          placeholder="What's in this dataset, how was it collected, and what makes it useful?"
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sample">Sample preview (optional)</Label>
        <Textarea
          id="sample"
          rows={6}
          value={values.sample_preview_text}
          onChange={(e) => update("sample_preview_text", e.target.value)}
          placeholder='Paste a JSON array of up to 50 example rows, e.g. [{"name":"Acme","country":"DE"}]'
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Buyers see this on the listing page. JSON array or one JSON object per
          line.
        </p>
        {errors.sample_preview_text && (
          <p className="text-sm text-destructive">
            {errors.sample_preview_text}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button type="submit" disabled={submitting !== null}>
          {submitting === "published" && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isEditing && initial?.status === "published"
            ? "Update listing"
            : "Publish listing"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting !== null}
          onClick={() => submit("draft")}
        >
          {submitting === "draft" && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Save as draft
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={submitting !== null}
          onClick={() => navigate("/dashboard/listings")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
