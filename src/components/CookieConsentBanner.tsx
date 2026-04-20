import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const STORAGE_KEY = "wesourcedata_consent_v1";

export type ConsentChoices = {
  analytics: boolean;
  marketing: boolean;
  decided: boolean;
  decided_at?: string;
};

export function getStoredConsent(): ConsentChoices | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function recordConsents(
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

export function saveConsent(analytics: boolean, marketing: boolean, sessionId: string) {
  const choices: ConsentChoices = {
    analytics,
    marketing,
    decided: true,
    decided_at: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  recordConsents(
    { analytics, marketing, data_processing: true, terms_of_service: true },
    sessionId,
  );
  return choices;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [customising, setCustomising] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (!getStoredConsent()?.decided) setVisible(true);
  }, []);

  if (!visible) return null;

  function accept(a: boolean, m: boolean) {
    saveConsent(a, m, sessionId);
    setVisible(false);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm"
      role="dialog"
      aria-label="Cookie consent"
    >
      <div className="container mx-auto px-6 py-5">
        {!customising ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-2xl space-y-1">
              <p className="text-sm font-medium text-foreground">
                We use cookies to keep the platform working.
              </p>
              <p className="text-xs text-muted-foreground">
                WeSourceData (Ireland &amp; Belgium) processes personal data under GDPR.
                Essential cookies are always active.{" "}
                <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                  Privacy policy
                </a>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => setCustomising(true)}>
                Customise
              </Button>
              <Button variant="outline" size="sm" onClick={() => accept(false, false)}>
                Essential only
              </Button>
              <Button size="sm" onClick={() => accept(true, true)}>
                Accept all
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-foreground">Choose your cookie preferences</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <ConsentToggle
                label="Essential"
                description="Login session, security, CSRF protection. Cannot be disabled."
                checked={true}
                disabled
              />
              <ConsentToggle
                label="Analytics"
                description="Understand how the platform is used. No personal data shared."
                checked={analytics}
                onChange={setAnalytics}
              />
              <ConsentToggle
                label="Marketing"
                description="Relevant updates and early-access offers from WeSourceData."
                checked={marketing}
                onChange={setMarketing}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => accept(analytics, marketing)}>
                Save preferences
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCustomising(false)}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentToggle({
  label, description, checked, disabled, onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 ${disabled ? "opacity-60" : "hover:bg-muted/50"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary"
      />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </label>
  );
}
