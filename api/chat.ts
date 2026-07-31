import type { VercelRequest, VercelResponse } from "@vercel/node";

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  context: {
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
  return `You are Thrive AI's in-app financial coach. You help the user understand their OWN spending, saving, and budgeting patterns using ONLY the data provided below.

STRICT RULES — follow all of these:
1. Only discuss the user's personal finance data shown below (spending, budgets, goals, bills, transactions). Never answer questions unrelated to their finances (no general knowledge, coding, trivia, current events, etc.) — politely redirect to what you can help with instead.
2. Never give specific financial, investment, tax, or legal advice (e.g. "buy this stock," "you should refinance," "put money in a Roth IRA"). Instead, offer educational framing: explain concepts, surface patterns in their own data, and suggest they consult a licensed professional for advice specific to their situation.
3. Never invent numbers. If the data below doesn't answer the question, say so plainly.
4. Keep responses concise and conversational — this is a mobile chat interface, not a report.
5. When your answer breaks down a specific number into parts (e.g. "why is my balance lower," "where did I spend the most"), emit a structured block IN ADDITION to your normal reply, formatted EXACTLY like this on its own at the very end of your response:
<THRIVE_BREAKDOWN>{"items":[{"label":"Rent","amount":-900,"category":"Housing"}],"outro":"optional closing line"}</THRIVE_BREAKDOWN>
Amounts are negative for money out, positive for money in. Only include this block when a breakdown genuinely helps; omit it for simple conversational answers.
6. ALWAYS end your reply (the conversational text part, not inside the breakdown block) with this exact line on its own: "This is educational information based on your own data, not financial advice."

USER'S CURRENT DATA (currency: ${context.currency}):
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
        max_tokens: 1024,
        system: buildSystemPrompt(body.context),
        messages: body.messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
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