import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Database, Search, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatPrice,
  formatRecords,
  LISTING_CATEGORIES,
} from "@/lib/listings";
import { captureError } from "@/lib/events";

type Row = {
  id: string;
  title: string;
  description: string;
  category: string;
  price_per_record: number;
  total_records: number;
  currency: string;
  published_at: string | null;
};

const Marketplace = () => {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [maxPrice, setMaxPrice] = useState<number>(10);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id, title, description, category, price_per_record, total_records, currency, published_at",
        )
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (error) {
        captureError(error, { scope: "marketplace.load" });
        setRows([]);
        return;
      }
      setRows((data ?? []) as Row[]);
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (r.price_per_record > maxPrice) return false;
      if (
        q &&
        !r.title.toLowerCase().includes(q) &&
        !r.description.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, search, category, maxPrice]);

  const dashboardHref = user
    ? profile?.onboarding_completed
      ? "/dashboard"
      : "/onboarding"
    : "/auth";

  return (
    <main className="min-h-screen bg-background">
      {/* Top nav */}
      <nav className="border-b border-border bg-background">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-foreground">
            <Database className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Uber4Data</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/marketplace">Marketplace</Link>
            </Button>
            <Button asChild size="sm">
              <Link to={dashboardHref}>
                {user ? "Dashboard" : "Sign in"}
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      <section className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-6 py-10 md:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Marketplace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Browse compliant datasets
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground md:text-base">
            Per-record pricing. Anonymisation built in. Request access from any
            seller in a couple of clicks.
          </p>
        </div>
      </section>

      <section className="container mx-auto grid gap-8 px-6 py-10 md:grid-cols-[260px_1fr]">
        {/* Filters */}
        <aside className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="e.g. SaaS, EU, mobility…"
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Category
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {LISTING_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Max price / record
              </label>
              <span className="text-xs font-medium text-foreground">
                {formatPrice(maxPrice)}
              </span>
            </div>
            <Slider
              value={[maxPrice]}
              min={0}
              max={10}
              step={0.05}
              onValueChange={(v) => setMaxPrice(v[0])}
            />
          </div>
        </aside>

        {/* Results */}
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            {rows === null
              ? "Loading…"
              : `${filtered.length} ${filtered.length === 1 ? "listing" : "listings"}`}
          </p>

          {rows && filtered.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"
            >
              <h3 className="text-base font-semibold text-foreground">
                No listings match
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Try widening your filters or clearing the search.
              </p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {filtered.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/marketplace/${r.id}`}
                    className="group block h-full rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40"
                    style={{ boxShadow: "var(--shadow-soft)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        {r.category}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRecords(r.total_records)} records
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-foreground line-clamp-2">
                      {r.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                      {r.description}
                    </p>
                    <div className="mt-4 flex items-end justify-between border-t border-border pt-4">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          From
                        </p>
                        <p className="text-base font-semibold text-foreground">
                          {formatPrice(r.price_per_record, r.currency)}
                          <span className="text-xs font-normal text-muted-foreground">
                            {" "}
                            / record
                          </span>
                        </p>
                      </div>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        View <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
};

export default Marketplace;
