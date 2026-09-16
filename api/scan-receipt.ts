import type { VercelRequest, VercelResponse } from "@vercel/node";
import { captureApiError } from "./_lib/sentry";
import { createClient } from "@supabase/supabase-js";

// Same pattern as api/chat.ts throughout this file — verifies the caller's
// session, reserves against the same free-tier AI-question quota, and calls
// Anthropic directly. Kept self-contained (constants duplicated rather than
// imported from src/) per this project's api/*.ts convention.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Must match api/chat.ts's own copy — a receipt scan spends the exact same
// quota as an Advisor question (shares one pool, not a separate limit).
const FREE_MONTHLY_QUESTIONS = 3;

// Must match api/chat.ts's own copy — see its comment for why this exists.
const PRO_DAILY_QUESTIONS = 200;

// Vercel serverless functions reject request bodies over ~4.5MB outright
// (platform limit, not something bodyParser config can raise) — the client
// already downscales/compresses the photo before sending (see
// src/lib/imageCompress.ts), but this is checked again server-side rather
// than trusted, the same "never trust a client-side guarantee alone" stance
// as every other endpoint in this app. ~4MB of base64 (~3MB decoded) leaves
// comfortable headroom under that limit for the rest of the JSON payload.
const MAX_BASE64_LENGTH = 4_000_000;
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function currentMonthKeyUTC(): string {
  return new Date().toISOString().slice(0, 7);
}

function currentDayKeyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ScanReceiptRequestBody {
  image?: string; // base64, no "data:...;base64," prefix
  mediaType?: string;
  today?: string; // user's own local date, "YYYY-MM-DD" — see api/chat.ts's context.today for why
}

const CATEGORY_LIST = [
  "Food",
  "Housing",
  "Transport",
  "Entertainment",
  "Health",
  "Subscriptions",
  "Shopping",
  "Clothing",
  "Education",
  "Gym",
  "Kids",
  "Travel",
  "Utilities",
  "Insurance",
  "Other",
];

function buildSystemPrompt(today: string): string {
  return `You are Thrive AI's receipt scanner. You will be shown one photo of a purchase receipt or slip. Read it and propose it as a single transaction for the user to review and confirm — you never save anything yourself.

TODAY'S DATE IS ${today}. Any date you write must not be in the future relative to it.

From the image, determine:
- The merchant/store name — short and recognizable (e.g. "Woolworths", "Shell", "Amazon"), never invented.
- The total amount actually paid — the grand total on the receipt, not a subtotal, tax line, or single item.
- The date on the receipt, if it's legible and a real calendar date not in the future — otherwise use today's date.
- The single best-fitting category from EXACTLY this list (case-sensitive): ${CATEGORY_LIST.join(", ")}.

Reply with one short, friendly line confirming what you found (e.g. "Found a receipt from Woolworths for $42.18."), then this exact block on its own at the very end of your response:
<THRIVE_INTAKE>{"actions":[{"type":"transaction","name":"<merchant>","amount":<negative number>,"category":"<one of the list above>","date":"YYYY-MM-DD"}]}</THRIVE_INTAKE>

Rules:
- "amount" is always negative — a receipt is always an expense.
- Never invent a merchant name or amount you can't actually read. If the total isn't legible or clearly determinable, do NOT emit the block at all.
- If the photo isn't a legible receipt or purchase slip (blurry, the wrong subject, or empty), do NOT emit the block — just reply with a brief, friendly note that you couldn't read it and ask for a clearer photo.
- Do not add any financial advice or disclaimer — this is a one-shot scan, not a conversation.`;
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Server misconfigured: missing ANTHROPIC_API_KEY" });
    return;
  }

  const body = req.body as ScanReceiptRequestBody;
  if (!body?.image || typeof body.image !== "string") {
    res.status(400).json({ error: "Missing image" });
    return;
  }
  if (!body.mediaType || !ALLOWED_MEDIA_TYPES.has(body.mediaType)) {
    res.status(400).json({ error: "Unsupported image type" });
    return;
  }
  if (body.image.length > MAX_BASE64_LENGTH) {
    res.status(413).json({ error: "Image is too large" });
    return;
  }

  const today = body.today && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : new Date().toISOString().slice(0, 10);

  // Same atomic reserve-before-spend as api/chat.ts — a receipt scan is just
  // another AI question against the exact same pool, so this is the same
  // RPC with the same limit, not a parallel counter.
  const { data: quota, error: quotaError } = await supabaseAdmin.rpc("use_ai_question", {
    p_user_id: authData.user.id,
    p_month: currentMonthKeyUTC(),
    p_limit: FREE_MONTHLY_QUESTIONS,
    p_day: currentDayKeyUTC(),
    p_day_limit: PRO_DAILY_QUESTIONS,
  });
  if (quotaError) {
    console.error("use_ai_question RPC error:", quotaError);
    res.status(500).json({ error: "Could not verify your question limit. Please try again." });
    return;
  }
  const quotaRow = Array.isArray(quota) ? quota[0] : quota;
  if (!quotaRow?.allowed) {
    const message =
      quotaRow?.reason === "pro_daily_limit"
        ? "You've hit today's usage limit for the AI Advisor. It resets tomorrow — please try again then."
        : `You've used your ${FREE_MONTHLY_QUESTIONS} free questions this month. Upgrade to Pro for unlimited access.`;
    res.status(402).json({ error: message });
    return;
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: buildSystemPrompt(today),
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: body.mediaType, data: body.image } },
              { type: "text", text: "Here's a photo of my receipt." },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      res.status(response.status).json({ error: "Claude API error", detail: errText });
      return;
    }

    const data = await response.json();
    const text = data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
    res.status(200).json({ text });
  } catch (err) {
    console.error("scan-receipt error:", err);
    captureApiError(err, { route: "scan-receipt" });
    res.status(500).json({ error: "Request failed", detail: err instanceof Error ? err.message : String(err) });
  }
}
