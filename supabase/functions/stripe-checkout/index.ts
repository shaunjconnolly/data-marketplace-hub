import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "STRIPE_SECRET_KEY secret is not set" }, 500);

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const { listing_id, record_count } = body ?? {};
    if (!listing_id || !record_count) return json({ error: "Missing listing_id or record_count" }, 400);

    const { data: listing } = await supabase
      .from("listings")
      .select("id, title, price_per_record, total_records, currency, seller_id")
      .eq("id", listing_id)
      .eq("status", "published")
      .maybeSingle();

    if (!listing) return json({ error: "Listing not found" }, 404);
    if (listing.seller_id === user.id) return json({ error: "Cannot purchase your own listing" }, 400);

    const count = Math.max(1, Math.min(listing.total_records, Math.floor(record_count)));
    const currency = (listing.currency ?? "USD").toLowerCase();
    const totalCents = Math.round(listing.price_per_record * count * 100);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id, full_name")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id as string | undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.full_name ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const { data: purchase, error: purchaseError } = await admin
      .from("purchases")
      .insert({
        listing_id: listing.id,
        buyer_id: user.id,
        price_per_record: listing.price_per_record,
        record_count: count,
        total_amount: listing.price_per_record * count,
        currency: listing.currency ?? "USD",
        payment_provider: "stripe",
        payment_status: "pending",
      })
      .select("id")
      .single();

    if (purchaseError) return json({ error: purchaseError.message }, 500);

    const origin = req.headers.get("origin") ?? `https://${req.headers.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency,
          product_data: { name: listing.title, description: `${count.toLocaleString()} records` },
          unit_amount: totalCents,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/dashboard/purchases?payment=success&purchase_id=${purchase.id}`,
      cancel_url: `${origin}/marketplace/${listing_id}`,
      metadata: { purchase_id: purchase.id, listing_id: listing.id, buyer_id: user.id },
    });

    await admin.from("purchases").update({ stripe_session_id: session.id }).eq("id", purchase.id);

    return json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("stripe-checkout error:", message);
    return json({ error: message }, 500);
  }
});
