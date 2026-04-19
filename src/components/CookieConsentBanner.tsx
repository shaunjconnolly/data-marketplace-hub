import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "wesourcedata_consent_v1";

type ConsentState = {
  analytics: boolean;
  marketing: boolean;
  decided: boolean;
};

function getStored(): ConsentState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function recordConsents(
  purposes: Record<string, boolean>,
  sessionId: string,
) {
  const { data: { user } } = await supabase.auth.getUser();
  const inserts = Object.entries(purposes).map(([purpose, consented]) => ({
    purpose,
    consented,
    user_id: user?.id ?? null,
    session_id: sessionId,
    user_agent: navigator.userAgent,
  }));
  await supabase.from("consent_records").insert(inserts);
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!getStored()?.decided) setVisible(true);
  }, []);

  if (!visible) return null;

  function save(analytics: boolean, marketing: boolean) {
    const state: ConsentState = { analytics, marketing, decided: true };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    recordConsents(
      { analytics, marketing, data_processing: true, terms_of_service: true },
      sessionId,
    );
    setVisible(false);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="container mx-auto flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-1">
          <p className="text-sm font-medium text-foreground">
            We use cookies to keep the platform working.
          </p>
          <p className="text-xs text-muted-foreground">
            WeSourceData is operated from Ireland and Belgium and processes personal
            data in accordance with GDPR. Essential cookies are always active.
            You can optionally allow analytics and marketing cookies.{" "}
            <a
              href="/privacy"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Privacy policy
            </a>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => save(false, false)}
          >
            Essential only
          </Button>
          <Button size="sm" onClick={() => save(true, true)}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
