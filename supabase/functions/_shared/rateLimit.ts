import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

/**
 * Check and increment a sliding 1-minute window rate limit.
 *
 * @param ip        - Client IP (from x-forwarded-for or x-real-ip)
 * @param endpoint  - Short slug identifying the function, e.g. "waitlist-join"
 * @param limit     - Max requests allowed per minute for this endpoint
 * @returns { limited: true } when the caller should receive a 429,
 *          { limited: false } when the request should proceed.
 */
export async function checkRateLimit(
  ip: string,
  endpoint: string,
  limit: number,
): Promise<{ limited: boolean; remaining: number }> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Truncate to the current minute so all requests in the same minute
  // share one row.
  const windowStart = new Date();
  windowStart.setSeconds(0, 0);
  const identifier = `${ip}:${endpoint}`;

  // Upsert: insert new row or increment existing counter atomically.
  const { data, error } = await supabase.rpc("upsert_rate_limit", {
    p_identifier: identifier,
    p_window_start: windowStart.toISOString(),
  });

  if (error) {
    // On DB error, fail open so legitimate users aren't blocked.
    console.error("rate-limit error:", error.message);
    return { limited: false, remaining: limit };
  }

  const count = data as number;
  const remaining = Math.max(0, limit - count);
  return { limited: count > limit, remaining };
}

/**
 * Extract the best available client IP from the request headers.
 * Supabase edge functions run behind a proxy, so x-forwarded-for is reliable.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/** Standard 429 response. */
export function rateLimitedResponse(
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "Too many requests. Please wait a moment and try again.",
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    },
  );
}
