import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Inbox, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  formatPrice,
  type AccessRequestStatus,
} from "@/lib/listings";
import { captureError } from "@/lib/events";

type IncomingRow = {
  id: string;
  message: string | null;
  status: AccessRequestStatus;
  created_at: string;
  buyer_id: string;
  listing: {
    id: string;
    title: string;
    price_per_record: number;
    currency: string;
  } | null;
  buyer: { display_name: string | null; company: string | null } | null;
};

type OutgoingRow = {
  id: string;
  message: string | null;
  status: AccessRequestStatus;
  created_at: string;
  listing: {
    id: string;
    title: string;
    price_per_record: number;
    currency: string;
  } | null;
};

function statusClass(s: AccessRequestStatus) {
  switch (s) {
    case "approved":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "declined":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
}

const Requests = () => {
  const { user, profile } = useAuth();
  const [incoming, setIncoming] = useState<IncomingRow[] | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingRow[] | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const sellerEnabled =
    profile?.primary_role === "seller" || profile?.primary_role === "both";
  const buyerEnabled =
    profile?.primary_role === "buyer" || profile?.primary_role === "both";

  const loadIncoming = useCallback(async () => {
    if (!user) return;
    // Find listings owned by me, then requests on those listings.
    const { data: myListings, error: lErr } = await supabase
      .from("listings")
      .select("id, title, price_per_record, currency")
      .eq("seller_id", user.id);
    if (lErr) {
      captureError(lErr, { scope: "requests.loadIncoming.listings" });
      setIncoming([]);
      return;
    }
    const ids = (myListings ?? []).map((l) => l.id);
    if (ids.length === 0) {
      setIncoming([]);
      return;
    }
    const { data: reqs, error } = await supabase
      .from("access_requests")
      .select("id, message, status, created_at, buyer_id, listing_id")
      .in("listing_id", ids)
      .order("created_at", { ascending: false });
    if (error) {
      captureError(error, { scope: "requests.loadIncoming" });
      setIncoming([]);
      return;
    }
    const buyerIds = Array.from(new Set((reqs ?? []).map((r) => r.buyer_id)));
    const { data: buyers } = buyerIds.length
      ? await supabase
          .from("profiles")
          .select("id, display_name, company")
          .in("id", buyerIds)
      : { data: [] };

    const listingMap = new Map((myListings ?? []).map((l) => [l.id, l]));
    const buyerMap = new Map(
      (buyers ?? []).map((b) => [b.id, b] as [string, IncomingRow["buyer"]]),
    );

    setIncoming(
      (reqs ?? []).map((r) => ({
        id: r.id,
        message: r.message,
        status: r.status as AccessRequestStatus,
        created_at: r.created_at,
        buyer_id: r.buyer_id,
        listing: listingMap.get(r.listing_id) ?? null,
        buyer: buyerMap.get(r.buyer_id) ?? null,
      })),
    );
  }, [user]);

  const loadOutgoing = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("access_requests")
      .select("id, message, status, created_at, listing_id")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      captureError(error, { scope: "requests.loadOutgoing" });
      setOutgoing([]);
      return;
    }
    const listingIds = Array.from(
      new Set((data ?? []).map((r) => r.listing_id)),
    );
    const { data: listings } = listingIds.length
      ? await supabase
          .from("listings")
          .select("id, title, price_per_record, currency")
          .in("id", listingIds)
      : { data: [] };
    const map = new Map((listings ?? []).map((l) => [l.id, l]));
    setOutgoing(
      (data ?? []).map((r) => ({
        id: r.id,
        message: r.message,
        status: r.status as AccessRequestStatus,
        created_at: r.created_at,
        listing: map.get(r.listing_id) ?? null,
      })),
    );
  }, [user]);

  useEffect(() => {
    loadIncoming();
    loadOutgoing();
  }, [loadIncoming, loadOutgoing]);

  async function decide(id: string, status: "approved" | "declined") {
    setWorking(id);
    const { error } = await supabase
      .from("access_requests")
      .update({ status })
      .eq("id", id);
    setWorking(null);
    if (error) {
      captureError(error, { scope: "requests.decide" });
      toast.error("Could not update request");
      return;
    }
    toast.success(status === "approved" ? "Request approved" : "Request declined");
    setIncoming(
      (rows) =>
        rows?.map((r) => (r.id === id ? { ...r, status } : r)) ?? null,
    );
  }

  const defaultTab = sellerEnabled ? "incoming" : "outgoing";

  return (
    <div className="container mx-auto max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Access requests
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Approve buyer requests on your listings and track requests you've sent.
        </p>
      </header>

      <Tabs defaultValue={defaultTab} className="mt-8">
        <TabsList>
          {sellerEnabled && (
            <TabsTrigger value="incoming">
              Incoming
              {incoming && incoming.filter((r) => r.status === "pending").length > 0 && (
                <span className="ml-2 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  {incoming.filter((r) => r.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
          )}
          {buyerEnabled && <TabsTrigger value="outgoing">My requests</TabsTrigger>}
        </TabsList>

        {sellerEnabled && (
          <TabsContent value="incoming" className="mt-6 space-y-4">
            {incoming === null ? (
              <Loader />
            ) : incoming.length === 0 ? (
              <Empty
                title="No incoming requests yet"
                body="When a buyer requests access to one of your listings, it appears here."
              />
            ) : (
              incoming.map((r) => (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                      <Link
                        to={`/marketplace/${r.listing?.id ?? ""}`}
                        className="mt-1 block text-base font-semibold text-foreground hover:underline"
                      >
                        {r.listing?.title ?? "Listing"}
                      </Link>
                      <p className="mt-1 text-sm text-muted-foreground">
                        From{" "}
                        <span className="font-medium text-foreground">
                          {r.buyer?.display_name || "Anonymous buyer"}
                        </span>
                        {r.buyer?.company && ` · ${r.buyer.company}`}
                        {r.listing && (
                          <>
                            {" · "}
                            {formatPrice(r.listing.price_per_record, r.listing.currency)} / record
                          </>
                        )}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  {r.message && (
                    <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">
                      "{r.message}"
                    </p>
                  )}
                  {r.status === "pending" && (
                    <div className="mt-4 flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={working === r.id}
                        onClick={() => decide(r.id, "declined")}
                      >
                        <X className="mr-1.5 h-4 w-4" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        disabled={working === r.id}
                        onClick={() => decide(r.id, "approved")}
                      >
                        {working === r.id ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="mr-1.5 h-4 w-4" />
                        )}
                        Approve
                      </Button>
                    </div>
                  )}
                </Card>
              ))
            )}
          </TabsContent>
        )}

        {buyerEnabled && (
          <TabsContent value="outgoing" className="mt-6 space-y-4">
            {outgoing === null ? (
              <Loader />
            ) : outgoing.length === 0 ? (
              <Empty
                title="No requests sent"
                body="Browse the marketplace and request access to a dataset."
                cta={{ label: "Browse marketplace", to: "/marketplace" }}
              />
            ) : (
              outgoing.map((r) => (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </p>
                      <Link
                        to={`/marketplace/${r.listing?.id ?? ""}`}
                        className="mt-1 block text-base font-semibold text-foreground hover:underline"
                      >
                        {r.listing?.title ?? "Listing"}
                      </Link>
                      {r.listing && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {formatPrice(r.listing.price_per_record, r.listing.currency)} / record
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusClass(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  {r.message && (
                    <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-sm text-foreground">
                      "{r.message}"
                    </p>
                  )}
                </Card>
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      {children}
    </div>
  );
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Empty({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { label: string; to: string };
}) {
  return (
    <div
      className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center"
    >
      <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
      <h3 className="mt-3 text-base font-semibold text-foreground">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {body}
      </p>
      {cta && (
        <Button asChild className="mt-6">
          <Link to={cta.to}>{cta.label}</Link>
        </Button>
      )}
    </div>
  );
}

export default Requests;
