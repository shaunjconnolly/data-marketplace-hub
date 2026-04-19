import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Upload, FileCheck2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
    file_path?: string | null;
    file_size_bytes?: number | null;
    file_mime?: string | null;
    file_original_name?: string | null;
  };
};

const ACCEPTED = ".csv,.json,.ndjson,.jsonl,application/json,text/csv";
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50 MB

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function ListingForm({ initial }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!initial?.id;
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const [file, setFile] = useState<{
    path: string | null;
    size: number | null;
    mime: string | null;
    name: string | null;
  }>({
    path: initial?.file_path ?? null,
    size: initial?.file_size_bytes ?? null,
    mime: initial?.file_mime ?? null,
    name: initial?.file_original_name ?? null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<null | "draft" | "published">(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  function update<K extends keyof ListingFormValues>(
    key: K,
    value: ListingFormValues[K],
  ) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  async function handleFile(selected: File) {
    if (!user) return;
    if (selected.size > MAX_UPLOAD_BYTES) {
      toast.error(
        `File is too large (max ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB)`,
      );
      return;
    }

    const lowerName = selected.name.toLowerCase();
    const looksRight =
      lowerName.endsWith(".csv") ||
      lowerName.endsWith(".json") ||
      lowerName.endsWith(".ndjson") ||
      lowerName.endsWith(".jsonl");
    if (!looksRight) {
      toast.error("Please upload a .csv, .json, .ndjson, or .jsonl file");
      return;
    }

    setUploading(true);
    setUploadProgress(15);
    try {
      // Path: {user_id}/{timestamp}-{filename}
      const safeName = selected.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;

      const { error: upErr } = await supabase.storage
        .from("dataset-files")
        .upload(path, selected, {
          cacheControl: "3600",
          upsert: false,
          contentType: selected.type || undefined,
        });
      if (upErr) throw upErr;
      setUploadProgress(60);

      // Call parse function
      const { data: parseData, error: parseErr } =
        await supabase.functions.invoke("parse-dataset", {
          body: {
            file_path: path,
            file_mime: selected.type,
            file_original_name: selected.name,
          },
        });
      if (parseErr) throw parseErr;
      setUploadProgress(100);

      setFile({
        path,
        size: selected.size,
        mime: selected.type,
        name: selected.name,
      });

      // Auto-fill sample preview + total records
      if (parseData?.sample) {
        setValues((v) => ({
          ...v,
          sample_preview_text: JSON.stringify(parseData.sample, null, 2),
          total_records: parseData.total_records ?? v.total_records,
        }));
        setErrors((e) => ({
          ...e,
          sample_preview_text: "",
          total_records: "",
        }));
      }

      toast.success(
        `Parsed ${parseData?.total_records ?? 0} records from ${selected.name}`,
      );
    } catch (err) {
      captureError(err, { scope: "listing.upload" });
      toast.error(
        err instanceof Error ? err.message : "Upload or parsing failed",
      );
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(0), 600);
    }
  }

  async function removeFile() {
    if (!file.path) {
      setFile({ path: null, size: null, mime: null, name: null });
      return;
    }
    try {
      await supabase.storage.from("dataset-files").remove([file.path]);
    } catch (err) {
      // non-fatal — clear locally anyway
      captureError(err, { scope: "listing.removeFile" });
    }
    setFile({ path: null, size: null, mime: null, name: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        sample_preview: sample as never,
        status: targetStatus,
        published_at:
          targetStatus === "published" ? new Date().toISOString() : null,
        seller_id: user.id,
        file_path: file.path,
        file_size_bytes: file.size,
        file_mime: file.mime,
        file_original_name: file.name,
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

      <div className="space-y-2">
        <Label htmlFor="dataset-file">Dataset file</Label>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          {file.path ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileCheck2 className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.name ?? file.path}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file.size != null ? formatBytes(file.size) : "—"}
                    {file.mime ? ` · ${file.mime}` : ""}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                disabled={uploading || submitting !== null}
              >
                <X className="mr-1 h-4 w-4" />
                Remove
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Upload className="h-4 w-4" />
                Upload a CSV, JSON, or NDJSON file. We'll auto-fill the sample
                and record count.
              </div>
              <Input
                id="dataset-file"
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED}
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="cursor-pointer"
              />
              {uploading && (
                <div className="w-full space-y-1">
                  <Progress value={uploadProgress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    Uploading and parsing…
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Stored privately. Only you and the buyers you approve can access it.
          Max 50&nbsp;MB.
        </p>
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
        <Label htmlFor="sample">Sample preview</Label>
        <Textarea
          id="sample"
          rows={6}
          value={values.sample_preview_text}
          onChange={(e) => update("sample_preview_text", e.target.value)}
          placeholder='Paste a JSON array of up to 50 example rows, e.g. [{"name":"Acme","country":"DE"}]'
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Auto-filled when you upload a file. You can edit it freely.
        </p>
        {errors.sample_preview_text && (
          <p className="text-sm text-destructive">
            {errors.sample_preview_text}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <Button
          type="submit"
          disabled={submitting !== null || uploading}
        >
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
          disabled={submitting !== null || uploading}
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
