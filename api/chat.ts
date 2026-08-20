import type { VercelRequest, VercelResponse } from "@vercel/node";

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
Amounts are negative for money out, positive for money in. Only include this block when a breakdown genuinely helps; omit it for simple conversational answers.
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
- Total balance: ${context.netWorth}
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
    res.status(500).json({ error: "Request failed", detail: err instanceof Error ? err.message : String(err) });
  }
}
