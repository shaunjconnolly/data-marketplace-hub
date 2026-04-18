import { z } from "zod";
import { LISTING_CATEGORIES } from "@/lib/listings";

export const listingSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120),
  description: z
    .string()
    .trim()
    .min(20, "Description must be at least 20 characters")
    .max(4000),
  category: z.enum(LISTING_CATEGORIES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: "Pick a category" }),
  }),
  price_per_record: z.coerce
    .number()
    .min(0, "Price must be 0 or more")
    .max(1000, "Price seems too high"),
  total_records: z.coerce
    .number()
    .int("Must be a whole number")
    .min(1, "Must be at least 1 record")
    .max(1_000_000_000),
  sample_preview_text: z
    .string()
    .max(8000, "Sample is too long")
    .optional(),
});

export type ListingFormValues = z.infer<typeof listingSchema>;

/**
 * Parse free-form sample text into a JSON array.
 * Accepts:
 *  - Valid JSON array
 *  - Newline-delimited JSON (NDJSON)
 *  - Empty input -> []
 */
export function parseSamplePreview(text: string | undefined): unknown[] {
  if (!text || !text.trim()) return [];
  const trimmed = text.trim();

  // Try JSON array first
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.slice(0, 50);
    return [parsed];
  } catch {
    // fallthrough
  }

  // Try NDJSON
  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
  const rows: unknown[] = [];
  for (const line of lines.slice(0, 50)) {
    try {
      rows.push(JSON.parse(line));
    } catch {
      rows.push({ value: line });
    }
  }
  return rows;
}
