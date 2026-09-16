import type { VercelRequest, VercelResponse } from "@vercel/node";
import { captureApiError } from "./_lib/sentry";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Paddle signs the raw request body; Vercel must not pre-parse it,
// or the HMAC check below will fail against reformatted JSON.
export const config = {
  api: {
    bodyParser: false,
  },
};

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET as string;

// Same "checkout-token:" domain-separated HMAC as
// api/paddle-create-checkout-token.ts — duplicated rather than imported,
// matching this project's convention of keeping each api/*.ts function
// self-contained (see api/chat.ts's own duplicated constants).
function signCheckoutToken(userId: string, exp: number): string {
  return crypto.createHmac("sha256", PADDLE_WEBHOOK_SECRET).update(`checkout-token:${userId}:${exp}`).digest("hex");
}

/**
 * Verifies a checkout token minted by api/paddle-create-checkout-token.ts
 * and returns the user id it was signed for, or null if it's missing,
 * malformed, expired, or doesn't verify.
 */
function verifyCheckoutToken(token: unknown): string | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp)) return null;
  if (Math.floor(Date.now() / 1000) > exp) return null;

  const expected = signCheckoutToken(userId, exp);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return null;
  return crypto.timingSafeEqual(a, b) ? userId : null;
}

/**
 * Who this subscription belongs to — the one thing every event handler
 * below needs, and the one thing that must NEVER come directly from the
 * client-editable custom_data.user_id (see the migration this depends on,
 * add_paddle_subscriptions_mapping.sql, for the full story).
 *
 * A subscription's identity is settled exactly once, the first time this
 * function sees its subscription_id: it requires a valid, unexpired
 * checkout_token minted by api/paddle-create-checkout-token.ts for a real
 * authenticated user, and stores that verified mapping permanently. Every
 * later event for the same subscription_id (renewals, cancellations, years
 * down the line, long after that original token has expired) reads the
 * stored mapping instead of re-checking the token — so the short token TTL
 * only ever has to outlive one checkout, never the subscription itself.
 */
async function resolveVerifiedUserId(subscriptionId: string | undefined, data: any): Promise<string | null> {
  if (!subscriptionId) return null;

  const { data: existing } = await supabaseAdmin
    .from("paddle_subscriptions")
    .select("user_id")
    .eq("subscription_id", subscriptionId)
    .maybeSingle();
  if (existing?.user_id) return existing.user_id;

  const verifiedUserId = verifyCheckoutToken(data?.custom_data?.checkout_token);
  if (!verifiedUserId) return null;

  const { error: mapError } = await supabaseAdmin
    .from("paddle_subscriptions")
    .insert({ subscription_id: subscriptionId, user_id: verifiedUserId });
  // 23505 here just means another concurrent event for the same brand-new
  // subscription already won the insert — not a real failure.
  if (mapError && mapError.code !== "23505") {
    console.error("paddle_subscriptions insert error:", mapError);
  }
  return verifiedUserId;
}

async function getRawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Paddle's signature stays valid forever on its own, so a captured
// "subscription.activated" body could be replayed after a cancellation to
// silently re-grant Pro. Reject anything older than this.
const MAX_SIGNATURE_AGE_SECONDS = 5 * 60;

function verifyPaddleSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  // Header format: "ts=1234567890;h1=abcdef..."
  const parts = Object.fromEntries(
    signatureHeader.split(";").map((p) => p.split("=") as [string, string])
  );
  const ts = parts.ts;
  const h1 = parts.h1;
  if (!ts || !h1) return false;

  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) return false;
  const ageSeconds = Math.abs(Date.now() / 1000 - tsSeconds);
  if (ageSeconds > MAX_SIGNATURE_AGE_SECONDS) return false;

  const signedPayload = `${ts}:${rawBody.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(h1, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const signatureHeader = req.headers["paddle-signature"] as string | undefined;
  if (!signatureHeader) {
    res.status(400).json({ error: "Missing Paddle-Signature header" });
    return;
  }

  const rawBody = await getRawBody(req);

  const valid = verifyPaddleSignature(rawBody, signatureHeader, PADDLE_WEBHOOK_SECRET);
  if (!valid) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON" });
    return;
  }

  const eventType = event.event_type as string;
  const data = event.data;

  try {
    switch (eventType) {
      case "subscription.created":
      case "subscription.activated":
      case "subscription.updated": {
        const userId = await resolveVerifiedUserId(data?.id, data);
        const status = data?.status; // "active" | "trialing" | "past_due" | "paused" | "canceled"
        if (userId) {
          const isPro = status === "active" || status === "trialing";
          await supabaseAdmin.from("profiles").update({ is_pro: isPro }).eq("id", userId);
        } else {
          // Most commonly: this is the first event for a brand-new
          // subscription and it arrived more than an hour after checkout
          // (CHECKOUT_TOKEN_TTL_SECONDS in paddle-create-checkout-token.ts),
          // so the token has expired and there's no stored mapping yet
          // either. The user has paid but is_pro never gets set — reported
          // to Sentry (not just console.error, unlike every other error path
          // in this file) so it's actually noticed instead of silently
          // requiring someone to go looking through raw Vercel logs.
          const msg = `Paddle webhook: couldn't verify a user for subscription ${data?.id} on ${eventType}`;
          console.error(msg);
          captureApiError(new Error(msg), { route: "paddle-webhook", eventType, subscriptionId: data?.id });
        }
        break;
      }

      case "subscription.canceled":
      case "subscription.paused": {
        const userId = await resolveVerifiedUserId(data?.id, data);
        if (userId) {
          await supabaseAdmin.from("profiles").update({ is_pro: false }).eq("id", userId);
        } else {
          const msg = `Paddle webhook: couldn't verify a user for subscription ${data?.id} on ${eventType}`;
          console.error(msg);
          captureApiError(new Error(msg), { route: "paddle-webhook", eventType, subscriptionId: data?.id });
        }
        break;
      }

      default:
        // Ignore event types we don't act on (transaction.*, etc.)
        break;
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("Paddle webhook handler error:", err);
    captureApiError(err, { route: "paddle-webhook" });
    res.status(500).json({ error: "Internal error processing webhook" });
  }
}