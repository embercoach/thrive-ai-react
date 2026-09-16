import { useState } from "react";
import { useT } from "@/hooks/useI18n";
import { Button } from "@/components/ui/Button";
import { getStoredConsent, setStoredConsent, type ConsentChoice } from "@/lib/consent";
import { initSentry } from "@/lib/sentry";

/**
 * First-visit banner covering the one thing in this app that actually
 * needs a visitor's consent: Sentry error reporting (see src/lib/consent.ts
 * for why — no cookies, no analytics, nothing else to ask about). Rendered
 * once, outside Gate/AppDataProvider in App.tsx, so it shows on the
 * public legal pages and the login screen too, not only once signed in.
 *
 * Deliberately two equally-weighted buttons rather than an "Accept" plus a
 * buried "Manage" link — declining should be exactly as easy as accepting.
 */
export function CookieConsentBanner() {
  const t = useT();
  // Lazy initializer so the very first render already reflects a past
  // choice — avoids a one-frame flash of the banner for a returning
  // visitor who already decided.
  const [choice, setChoice] = useState<ConsentChoice | null>(() => getStoredConsent());

  if (choice) return null;

  function decide(next: ConsentChoice) {
    setStoredConsent(next);
    setChoice(next);
    if (next === "accepted") {
      // No-op until VITE_SENTRY_DSN is set (see src/lib/sentry.ts) — safe
      // to call unconditionally on acceptance.
      initSentry();
    }
  }

  return (
    <div
      role="region"
      aria-label={t("cookieConsent.title")}
      className="fixed top-0 inset-x-0 z-[60] flex justify-center px-4 pt-4"
    >
      <div className="w-full max-w-[430px] rounded-2xl border border-border-strong bg-surface/95 backdrop-blur-xl shadow-lg p-4 flex flex-col gap-3">
        <p className="text-sm text-ink-secondary">{t("cookieConsent.message")}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" fullWidth onClick={() => decide("declined")}>
            {t("cookieConsent.decline")}
          </Button>
          <Button variant="primary" size="sm" fullWidth onClick={() => decide("accepted")}>
            {t("cookieConsent.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
