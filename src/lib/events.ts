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
    await supabase.from("captured_errors").insert([{ message, context }]);
  } catch {
    // swallow
  }
}
