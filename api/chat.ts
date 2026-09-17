import type { VercelRequest, VercelResponse } from "@vercel/node";
import { captureApiError } from "./_lib/sentry";
import { createClient } from "@supabase/supabase-js";

// Verifies the caller's Supabase session server-side before spending a call
// against the paid Anthropic API key. Uses the service-role key (same
// pattern as api/paddle-webhook.ts) purely to validate the bearer token via
// auth.getUser() — this client never reads or writes app data.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Must match the free-tier limit shown in the UI (src/hooks/useChat.ts).
// The client's own copy of this number is only ever used for a fast local
// pre-check and the "X of 3 left" display — this is the one that's actually
// enforced, via the use_ai_question() database function (see the
// lock_down_privileged_profile_columns migration).
const FREE_MONTHLY_QUESTIONS = 3;

// A soft ceiling on Pro usage — not a real product limit (Pro is sold and
// shown in the UI as unlimited), just a backstop against unbounded Anthropic
// spend from a single account (compromised session, or a script hammering
// this endpoint). Deliberately generous: a real person having real advisor
// conversations should never get anywhere close to this in a day. See the
// add_pro_daily_ai_cap migration for the DB side.
const PRO_DAILY_QUESTIONS = 200;

/**
 * "YYYY-MM" from THIS SERVER's own clock, deliberately not from anything
 * the client sent. `context.today` further down is fine to trust for the
 * model's own date-awareness (worst case it writes a wrong date on a
 * proposed transaction, which the user reviews before confirming) — but
 * trusting it here, for the free-question quota's reset boundary, would let
 * any caller simply claim a fresh month on every request and reset their
 * own counter on demand. UTC rather than the user's local month trades a
 * few hours of reset-timing looseness near midnight for not trusting client
 * input on a security-relevant check.
 */
function currentMonthKeyUTC(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Same reasoning as currentMonthKeyUTC, for the Pro daily cap's boundary. */
function currentDayKeyUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  context: {
    /**
     * The user's own local date ("YYYY-MM-DD"), sent by the client. The model
     * has no reliable sense of the current date on its own, and this server
     * runs in UTC — which can be a day off from the user — so "today" has to
     * come from the browser or dated writes land on the wrong day.
     */
    today?: string;
    currency: string;
    monthlyIncome: number;
    netWorth: number;
    availableToSpend: number;
    spendingByCategory: { category: string; amount: number; budget?: number }[];
    goals: { name: string; current: number; target: number }[];
    upcomingBills: { name: string; amount: number; dueDate: string }[];
    recentTransactions: { name: string; amount: number; category: string; date: string }[];
  };
}

/**
 * The Advisor only ever reasons over a compact summary of the user's own
 * data (never raw account numbers, never anyone else's data), refuses
 * specific financial/investment/tax advice in favor of educational
 * framing, and always closes with the disclaimer — this system prompt is
 * the actual product-safety boundary for the whole feature, not a
 * formality.
 */
function buildSystemPrompt(context: ChatRequestBody["context"]): string {
  const today = context.today || new Date().toISOString().split("T")[0];
  return `You are Thrive AI's in-app financial coach. You help the user understand their OWN spending, saving, and budgeting patterns using ONLY the data provided below.

TODAY'S DATE IS ${today}. Treat this as the authoritative current date — never guess or assume a different one. Any date you write must be derived from it (e.g. "today" is ${today}, "yesterday" is the day before it), and no date may be in the future relative to it.

STRICT RULES — follow all of these:
1. Only discuss the user's personal finance data shown below (spending, budgets, goals, bills, transactions). Never answer questions unrelated to their finances (no general knowledge, coding, trivia, current events, etc.) — politely redirect to what you can help with instead.
2. Never give specific financial, investment, tax, or legal advice (e.g. "buy this stock," "you should refinance," "put money in a Roth IRA"). Instead, offer educational framing: explain concepts, surface patterns in their own data, and suggest they consult a licensed professional for advice specific to their situation.
3. Never invent numbers. If the data below doesn't answer the question, say so plainly.
4. Keep responses concise and conversational — this is a mobile chat interface, not a report.
5. When your answer breaks down a specific number into parts (e.g. "why is my balance lower," "where did I spend the most"), emit a structured block IN ADDITION to your normal reply, formatted EXACTLY like this on its own at the very end of your response:
<THRIVE_BREAKDOWN>{"items":[{"label":"Rent","amount":-900,"category":"Housing"}],"outro":"optional closing line"}</THRIVE_BREAKDOWN>
Amounts are negative for money out, positive for money in. Only include this block when a breakdown genuinely helps; omit it for simple conversational answers. IMPORTANT: this block renders as its OWN separate list in the UI, after your conversational text — the user will see it, but never as part of the text you write. So never write a lead-in like "here's how it breaks down:" and then stop — either actually list the items yourself in your prose, or don't promise a list at all and let the block speak for itself.
6. ALWAYS end your reply (the conversational text part, not inside the breakdown block) with this exact line on its own: "This is educational information based on your own data, not financial advice."
7. If — and only if — the user is CLEARLY asking you to log, save, add, record, or track real data about their finances (not a hypothetical like "what if I spent $500 on rent" or a past-tense mention used only to ask a question like "I spent $50 on food, was that a lot?"), propose it as a structured intake block instead of just describing it back. Emit this block IN ADDITION to your normal reply, formatted EXACTLY like this on its own at the very end of your response (after any THRIVE_BREAKDOWN block, if both apply):
<THRIVE_INTAKE>{"actions":[{"type":"transaction","name":"Groceries","amount":-450,"category":"Food"},{"type":"recurring","name":"Rent","amount":-7000,"category":"Housing","frequency":"monthly"},{"type":"monthly_income","amount":28500}]}</THRIVE_INTAKE>
Rules for this block:
- "type" is one of "monthly_income" | "transaction" | "goal" | "recurring".
- Amounts are negative for money out (expenses/bills), positive for money in (income). For "monthly_income" and "goal", amount/target are always positive.
- "transaction": {type, name, amount, category, date?} — date is "YYYY-MM-DD" and must be derived from TODAY'S DATE above; omit it entirely unless the user stated a specific day, and never guess a date.
- "recurring": {type, name, amount, category, frequency?} — "monthly" or "weekly", default "monthly".
- "goal": {type, name, target, current?} — current defaults to 0.
- "monthly_income": {type, amount} only.
- Never include more than 20 actions in one block. If the user described more, include the first 20 and say so in your text.
- Never invent amounts or names the user didn't state; if a detail like category is missing, make a reasonable guess rather than leaving it blank.
- This is a PROPOSAL only — the user must confirm it in the UI. Do not say "I've added this" — say something like "I've prepared these to add to your account — confirm below when ready."
- Omit this block entirely for questions, hypotheticals, or when no concrete real data was described.

USER'S CURRENT DATA (currency: ${context.currency}, today: ${today}):
- Monthly income: ${context.monthlyIncome || "not set"}
- Total balance (net worth): ${context.netWorth} — this already includes any linked bank balances PLUS any manual assets (investments, property, vehicles, cash) they've added under Net Worth in their Profile. If asked about "net worth," this is the number to use — don't say you don't have it. It only omits debts/liabilities they haven't entered anywhere in the app.
- Available to spend: ${context.availableToSpend}
- Spending by category this month: ${JSON.stringify(context.spendingByCategory)}
- Goals: ${JSON.stringify(context.goals)}
- Upcoming bills: ${JSON.stringify(context.upcomingBills)}
- Recent transactions: ${JSON.stringify(context.recentTransactions)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // This route previously had NO identity check at all — anyone who found
  // the URL, signed in or not, could call it directly (bypassing the app's
  // own free-question UI entirely) and consume the app's own paid Anthropic
  // API budget with no limit. Every caller must now present a valid
  // Supabase session for a real account before a single token is spent.
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

  const body = req.body as ChatRequestBody;
  if (!body?.messages?.length) {
    res.status(400).json({ error: "Missing messages" });
    return;
  }
  // Sanity bounds, not a product limit — the client sends the full visible
  // conversation history on every turn (see useChat.ts's `history`) and a
  // real conversation comes nowhere near these numbers. This exists purely
  // to reject a wildly oversized payload (a scripted request faking a huge
  // history, not a real user) before it reaches Anthropic and gets billed.
  const MAX_MESSAGES = 200;
  const MAX_MESSAGE_LENGTH = 8_000;
  if (body.messages.length > MAX_MESSAGES || body.messages.some((m) => (m.content?.length ?? 0) > MAX_MESSAGE_LENGTH)) {
    res.status(400).json({ error: "Message or conversation too large" });
    return;
  }

  // Atomically checks-and-reserves this question against the free-tier
  // limit BEFORE spending a call on Anthropic — reserving first (rather
  // than incrementing only after a successful reply) is what makes this
  // race-proof: two concurrent requests from two tabs can't both pass a
  // separate check and then both write "+1" after the fact. The one real
  // cost is that a request which reserves a slot and then fails on the
  // Anthropic call below still spends that slot — an acceptable trade for
  // closing the race, and rare in practice.
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
    if (quotaRow?.reason === "not_found") {
      // use_ai_question returns this when there's no profiles row for this
      // user at all (post-signup trigger hasn't run yet, or the row was
      // otherwise never created) — a data-integrity problem, not a quota
      // state, so it must never fall through to the free-tier message
      // below and tell someone they've "used their free questions" when
      // they may not have asked any.
      console.error("use_ai_question: no profile row for user", authData.user.id);
      res.status(500).json({ error: "Something went wrong checking your account. Please try again." });
      return;
    }
    // reason disambiguates which cap was hit — a Pro account hitting the
    // generous daily backstop should never be told it ran out of "free
    // questions this month", which is the free tier's own limit.
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
        max_tokens: 3072,
        system: buildSystemPrompt(body.context),
        messages: body.messages,
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
    console.error("chat error:", err);
    captureApiError(err, { route: "chat" });
    res.status(500).json({ error: "Request failed", detail: err instanceof Error ? err.message : String(err) });
  }
}
