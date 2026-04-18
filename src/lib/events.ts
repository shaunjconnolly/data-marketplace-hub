// Client-side helper for capturing exceptions to the captured_errors table.
// For server-side audit logging, use the Edge Function pattern (service role).
import { supabase } from "@/integrations/supabase/client";

export async function captureClientError(
  message: string,
  context: Record<string, unknown> = {},
) {
  try {
    // Note: captured_errors has no insert policy for clients by design.
    // This will be a no-op unless called from a context with admin rights.
    // Prefer routing errors through Edge Functions where possible.
    await supabase.from("captured_errors").insert([
      { message, context: context as never },
    ]);
  } catch {
    // swallow
  }
}

/**
 * Convenience wrapper that accepts an unknown error value (Error, string, or
 * anything else) and forwards it to captureClientError. Also logs to the
 * browser console so developers can see issues during local dev.
 */
export function captureError(err: unknown, context: Record<string, unknown> = {}) {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Unknown error";
  const ctx = {
    ...context,
    ...(err instanceof Error ? { stack: err.stack } : {}),
  };
  // eslint-disable-next-line no-console
  console.error("[captureError]", message, ctx);
  void captureClientError(message, ctx);
}
