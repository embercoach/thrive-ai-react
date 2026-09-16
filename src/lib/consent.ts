/**
 * Local-only store for the cookie/storage consent choice shown by
 * CookieConsentBanner. Deliberately tiny: this app sets no tracking
 * cookies and ships no analytics library (checked directly in the
 * source — no gtag/analytics/mixpanel/amplitude/hotjar/posthog anywhere,
 * and no direct `document.cookie` usage at all). The two things that
 * actually touch the browser's storage are:
 *
 *  - localStorage, for strictly functional preferences (theme, language,
 *    and this consent choice itself) — "strictly necessary" under GDPR/
 *    ePrivacy and never gated behind consent.
 *  - Sentry (src/lib/sentry.ts), which — once VITE_SENTRY_DSN is set —
 *    reports crashes/errors including the reporting device's IP address.
 *    That's the one thing worth asking about, so it's the one thing this
 *    banner actually gates.
 *
 * "accepted" enables Sentry error reporting; "declined" keeps it off.
 * Either choice suppresses the banner — declining is exactly as easy as
 * accepting, with no dark-pattern nagging to reconsider.
 */
export type ConsentChoice = "accepted" | "declined";

const STORAGE_KEY = "thrive-consent";

export function getStoredConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "accepted" || raw === "declined" ? raw : null;
  } catch {
    // localStorage can throw in some private-browsing contexts. Treat as
    // "no choice recorded" — the banner will show every visit, which is
    // the safe direction to fail in (never silently enables error
    // reporting the visitor never agreed to).
    return null;
  }
}

export function setStoredConsent(choice: ConsentChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Same private-browsing caveat as above — nothing else to do here;
    // the banner will just reappear next load, which is harmless.
  }
}
