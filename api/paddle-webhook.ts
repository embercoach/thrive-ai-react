import type { VercelRequest, VercelResponse } from "@vercel/node";
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
        const userId = data?.custom_data?.user_id;
        const status = data?.status; // "active" | "trialing" | "past_due" | "paused" | "canceled"
        if (userId) {
          const isPro = status === "active" || status === "trialing";
          await supabaseAdmin.from("profiles").update({ is_pro: isPro }).eq("id", userId);
        }
        break;
      }

      case "subscription.canceled":
      case "subscription.paused": {
        const userId = data?.custom_data?.user_id;
        if (userId) {
          await supabaseAdmin.from("profiles").update({ is_pro: false }).eq("id", userId);
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
    res.status(500).json({ error: "Internal error processing webhook" });
  }
}