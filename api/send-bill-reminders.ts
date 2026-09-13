import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Same pattern as api/chat.ts and api/paddle-webhook.ts: a service-role
// client that bypasses RLS entirely, because this job has to read and write
// across every user's data, not just one signed-in caller's own rows.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@example.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Deliberately not imported from src/lib/currency — api/ functions in this
// project are kept self-contained rather than sharing modules with the
// client bundle (see api/chat.ts's own duplicated constants), so this is a
// small subset good enough for a push notification's body text.
const SYMBOLS: Record<string, string> = {
  USD: "$",
  ZAR: "R",
  EUR: "€",
  GBP: "£",
  AUD: "A$",
  CAD: "C$",
  INR: "₹",
  NGN: "₦",
};
function formatAmount(amount: number, currency?: string | null): string {
  const symbol = SYMBOLS[currency || "USD"] || "$";
  return symbol + Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayUTCStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Inserts a notification_log row for this exact occurrence and reports
 * whether it was actually new. The insert (not a prior SELECT) is what
 * decides that — two overlapping cron runs racing on the same occurrence
 * both attempt the insert, and the dedupe_key's unique constraint lets
 * exactly one of them win, the same "reserve first" pattern api/chat.ts
 * uses for its AI-question quota.
 */
async function tryClaim(userId: string, kind: string, dedupeKey: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from("notification_log").insert({ user_id: userId, kind, dedupe_key: dedupeKey });
  if (error) {
    if (error.code !== "23505") console.error("notification_log insert error:", error);
    return false;
  }
  return true;
}

/** Sends one push to every device this user has enabled notifications on.
 *  A subscription the push service reports as gone (404/410 — the user
 *  uninstalled, cleared permissions, etc.) is deleted so this stops trying
 *  it forever; any other failure is logged and left alone in case it's
 *  transient. */
async function pushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs?.length) return false;

  let sentAny = false;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      );
      sentAny = true;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.error("web-push send error:", err);
      }
    }
  }
  return sentAny;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on
  // requests it triggers itself when that env var is set — this is what
  // stops anyone who finds this URL from spamming every user's phone.
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    res.status(500).json({ error: "Server misconfigured: missing VAPID keys" });
    return;
  }

  const today = todayUTCStr();
  const tomorrow = addDaysStr(today, 1);
  const monthKey = today.slice(0, 7);
  const monthStart = `${monthKey}-01`;

  const results = { billsChecked: 0, billsSent: 0, budgetsChecked: 0, budgetsSent: 0 };

  try {
    // --- Bills due today, tomorrow, or overdue (not just an exact match on
    // "tomorrow") — a user who hasn't opened the app in a few days has a
    // stale next_date that's already in the past, and they still need the
    // heads-up. The dedupe_key is keyed on (recurring_id, next_date), so
    // re-checking the same stale next_date every day for someone who's away
    // still only ever sends once for that occurrence — it naturally stops
    // repeating the moment the app advances next_date past it.
    type DueBill = { id: string; user_id: string; name: string; amount: number; next_date: string; currency: string | null };
    const { data: dueBillsData, error: billsErr } = await supabaseAdmin
      .from("recurring")
      .select("id, user_id, name, amount, next_date, currency")
      .eq("active", true)
      .lte("next_date", tomorrow);
    if (billsErr) throw billsErr;
    const dueBills = (dueBillsData ?? []) as DueBill[];
    results.billsChecked = dueBills.length;

    const billLinesByUser = new Map<string, string[]>();
    for (const bill of dueBills) {
      const claimed = await tryClaim(bill.user_id, "bill_due", `${bill.id}:${bill.next_date}`);
      if (!claimed) continue;

      const when =
        bill.next_date === today ? "due today" : bill.next_date === tomorrow ? "due tomorrow" : "was due — check it hasn't been missed";
      const line = `${bill.name} (${formatAmount(bill.amount, bill.currency)}) is ${when}.`;
      const existing = billLinesByUser.get(bill.user_id) ?? [];
      existing.push(line);
      billLinesByUser.set(bill.user_id, existing);
    }

    // --- Over-budget categories, Pro only — matches the tiering the app's
    // own Home brief already applies to this exact insight.
    const { data: proProfiles, error: proErr } = await supabaseAdmin.from("profiles").select("id").eq("is_pro", true);
    if (proErr) throw proErr;
    results.budgetsChecked = proProfiles?.length ?? 0;

    const budgetLinesByUser = new Map<string, string[]>();
    for (const profile of proProfiles ?? []) {
      const { data: userBudgets } = await supabaseAdmin.from("budgets").select("category, amount").eq("user_id", profile.id);
      if (!userBudgets?.length) continue;

      const { data: txns } = await supabaseAdmin
        .from("transactions")
        .select("category, amount")
        .eq("user_id", profile.id)
        .gte("date", monthStart)
        .lte("date", today)
        .lt("amount", 0);

      const spentByCategory: Record<string, number> = {};
      for (const t of txns ?? []) {
        const key = (t.category || "Other").trim().toLowerCase();
        spentByCategory[key] = (spentByCategory[key] || 0) + Math.abs(Number(t.amount));
      }

      for (const b of userBudgets) {
        const spent = spentByCategory[b.category.trim().toLowerCase()] ?? 0;
        if (spent <= b.amount) continue;

        const claimed = await tryClaim(profile.id, "budget_over", `${b.category.trim().toLowerCase()}:${monthKey}`);
        if (!claimed) continue;

        const line = `${b.category} is over budget this month.`;
        const existing = budgetLinesByUser.get(profile.id) ?? [];
        existing.push(line);
        budgetLinesByUser.set(profile.id, existing);
      }
    }

    // One combined push per user, even if they have both a bill and a
    // budget alert today — better than buzzing someone's phone twice.
    const userIds = new Set([...billLinesByUser.keys(), ...budgetLinesByUser.keys()]);
    for (const userId of userIds) {
      const lines = [...(billLinesByUser.get(userId) ?? []), ...(budgetLinesByUser.get(userId) ?? [])];
      if (!lines.length) continue;

      const sent = await pushToUser(userId, {
        title: lines.length > 1 ? "You have new alerts" : billLinesByUser.has(userId) ? "Bill reminder" : "Over budget",
        body: lines.join("\n"),
        url: "/notifications",
      });
      if (sent) {
        if (billLinesByUser.has(userId)) results.billsSent++;
        if (budgetLinesByUser.has(userId)) results.budgetsSent++;
      }
    }

    res.status(200).json(results);
  } catch (err) {
    console.error("send-bill-reminders error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}
