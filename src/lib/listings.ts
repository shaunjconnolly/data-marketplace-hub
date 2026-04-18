export const LISTING_CATEGORIES = [
  "E-commerce",
  "Healthcare",
  "Finance",
  "Marketing",
  "Mobility",
  "IoT & Sensors",
  "Social Media",
  "Real Estate",
  "Other",
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export type ListingStatus = "draft" | "published" | "archived";

export type AccessRequestStatus = "pending" | "approved" | "declined";

export function formatPrice(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: amount < 1 ? 4 : 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatRecords(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function statusBadgeClass(status: ListingStatus) {
  switch (status) {
    case "published":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "draft":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    case "archived":
      return "bg-muted text-muted-foreground";
  }
}
