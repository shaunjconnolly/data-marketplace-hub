// Edge Function: waitlist-join
// Validates input, inserts to waitlist, logs audit event, captures errors.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const waitlistSchema = z.object({
  email: z.string().email("Please enter a valid email address").max(255),
  role: z.enum(["buyer", "seller", "both"]).optional(),
  company: z.string().max(200).optional(),
});

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function captureError(message: string, context: Record<string, unknown>) {
  try {
    await admin().from("captured_errors").insert({ message, context });
  } catch (_) {
    // swallow — error logging must never throw
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const json = await req.json().catch(() => null);
    const parsed = waitlistSchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid input",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { email, role, company } = parsed.data;
    const supabase = admin();

    // Duplicate check
    const { data: existing } = await supabase
      .from("waitlist")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "This email is already on the waitlist.",
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: entry, error: insertError } = await supabase
      .from("waitlist")
      .insert({
        email,
        role: role ?? null,
        company: company ?? null,
        source: "homepage",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Audit log
    await supabase.from("audit_log").insert({
      actor_id: null,
      actor_type: "anonymous",
      entity_type: "waitlist",
      entity_id: entry.id,
      action: "waitlist_joined",
      payload: { email, role: role ?? null },
    });

    return new Response(
      JSON.stringify({ ok: true, data: { id: entry.id } }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await captureError(message, { route: "waitlist-join" });
    return new Response(
      JSON.stringify({ ok: false, error: "Something went wrong." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
