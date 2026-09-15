import * as Sentry from "@sentry/react";

// Deliberately a no-op whenever VITE_SENTRY_DSN isn't set — local dev, CI,
// and any deployment that hasn't been given a DSN yet all keep working
// exactly as before, with nothing to configure and no missing-env-var
// crash. Once a real DSN is added in Vercel's project settings, error
// monitoring turns on with no code change.
const dsn = import.meta.env.VITE_SENTRY_DSN;

/** Call once, before the app renders (see main.tsx). */
export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    // Keep this cheap by default — 10% of sessions get performance
    // tracing, which is plenty to spot a regression without burning
    // through Sentry's free-tier event quota on a low-traffic app.
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE,
  });
}

/**
 * Reports an error Sentry's own automatic instrumentation wouldn't
 * otherwise see with useful context attached — right now that's just
 * ErrorBoundary's componentDidCatch, which knows the component stack that
 * crashed. Safe to call whether or not Sentry is configured: Sentry.
 * captureException is itself a no-op before Sentry.init() has run.
 */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
