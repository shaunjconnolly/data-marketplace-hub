// Edge Function: stripe-webhook
// Receives Stripe webhook events and updates the database accordingly.
// checkout.session.completed → marks purchase as paid
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
});

const admin = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    return new Response("Missing signature or webhook secret", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
  }

  const db = admin();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const purchaseId = session.metadata?.purchase_id;

    if (purchaseId) {
      await db.from("purchases").update({
        payment_status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      }).eq("id", purchaseId);

      // Write audit entry
      await db.from("audit_log").insert({
        actor_id: session.metadata?.buyer_id ?? null,
        actor_type: "user",
        entity_type: "purchase",
        entity_id: purchaseId,
        action: "purchase_completed",
        payload: {
          stripe_session_id: session.id,
          amount_total: session.amount_total,
          currency: session.currency,
        },
      });
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
