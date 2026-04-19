import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { checkRateLimit, getClientIp, rateLimitedResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SIGNED_URL_TTL = 60 * 60 * 24; // 24 hours

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 30 download URL requests per IP per minute
  const { limited } = await checkRateLimit(getClientIp(req), "dataset-download-url", 30);
  if (limited) return rateLimitedResponse(corsHeaders);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => null);
    const purchaseId: string | undefined = body?.purchase_id;
    if (!purchaseId) {
      return new Response(
        JSON.stringify({ error: "purchase_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Service-role to verify ownership across tables
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: purchase, error: pErr } = await admin
      .from("purchases")
      .select("id, buyer_id, listing_id, payment_status")
      .eq("id", purchaseId)
      .maybeSingle();
    if (pErr || !purchase) {
      return new Response(JSON.stringify({ error: "Purchase not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (purchase.buyer_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (purchase.payment_status !== "paid") {
      return new Response(
        JSON.stringify({ error: "Purchase is not paid" }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: listing, error: lErr } = await admin
      .from("listings")
      .select("id, file_path, file_original_name")
      .eq("id", purchase.listing_id)
      .maybeSingle();
    if (lErr || !listing) {
      return new Response(JSON.stringify({ error: "Listing not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!listing.file_path) {
      return new Response(
        JSON.stringify({
          error: "Seller has not uploaded a dataset file yet",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: signed, error: sErr } = await admin.storage
      .from("dataset-files")
      .createSignedUrl(listing.file_path, SIGNED_URL_TTL, {
        download: listing.file_original_name ?? undefined,
      });
    if (sErr || !signed) {
      return new Response(
        JSON.stringify({ error: sErr?.message ?? "Could not sign URL" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        url: signed.signedUrl,
        expires_in: SIGNED_URL_TTL,
        file_name: listing.file_original_name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("dataset-download-url error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
