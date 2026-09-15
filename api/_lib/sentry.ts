import * as Sentry from "@sentry/node";

// This one file is deliberately shared rather than duplicated into every
// api/*.ts route the way this project's own business constants are (see
// api/chat.ts's and api/paddle-webhook.ts's comments on that convention) —
// duplicating a whole SDK's init call nine times over would be pure
// boilerplate with no clarity benefit, unlike duplicating a small constant
// like FREE_MONTHLY_QUESTIONS. Vercel does not turn a file under a `_`-
// prefixed subfolder into its own route, so this stays internal-only.
let initialized = false;

function ensureInitialized(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  if (!initialized) {
    Sentry.init({
      dsn,
      // Same conservative sample rate as the client (src/lib/sentry.ts) —
      // enough to catch a regression without burning through Sentry's
      // free-tier event quota.
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV || "development",
    });
    initialized = true;
  }
  return true;
}

/**
 * Reports a serverless-function error to Sentry, in addition to (never
 * instead of) the existing console.error at each call site — Vercel's own
 * function logs remain the first place to look, this just means a broken
 * webhook or cron job surfaces on its own instead of waiting for someone
 * to notice missing Pro access or a missed bill reminder.
 *
 * A complete no-op until SENTRY_DSN is set in Vercel's project settings —
 * every api/*.ts route calling this keeps working exactly as before with
 * nothing to configure.
 */
export function captureApiError(err: unknown, context?: Record<string, unknown>): void {
  if (!ensureInitialized()) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
}
