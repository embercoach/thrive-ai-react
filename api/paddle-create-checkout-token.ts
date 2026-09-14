import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Same pattern as api/plaid-exchange-public-token.ts: verifies the caller's
// own Supabase session server-side rather than trusting anything the client
// claims about its own identity.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Reuses the existing Paddle webhook secret rather than needing a new env
// var — domain-separated below ("checkout-token:" prefix) so a value signed
// for this purpose can never be confused with (or substituted for) an actual
// Paddle webhook signature, and vice versa.
const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET as string;

// Generous — this only needs to outlive one checkout attempt (entering card
// details, 3DS, a slow connection), not the subscription itself. The
// webhook only ever checks this expiry on a subscription's very first event
// (see resolveVerifiedUserId in api/paddle-webhook.ts); once that succeeds,
// the verified mapping it stores has no expiry of its own, so renewals and
// cancellations months later are unaffected by this window.
const CHECKOUT_TOKEN_TTL_SECONDS = 60 * 60;

export function signCheckoutToken(userId: string, exp: number): string {
  return crypto.createHmac("sha256", PADDLE_WEBHOOK_SECRET).update(`checkout-token:${userId}:${exp}`).digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Missing or invalid authorization" });
    return;
  }
  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  const userId = authData.user.id;

  const exp = Math.floor(Date.now() / 1000) + CHECKOUT_TOKEN_TTL_SECONDS;
  const sig = signCheckoutToken(userId, exp);

  res.status(200).json({ token: `${userId}.${exp}.${sig}` });
}
