import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Same pattern as every other cron job in api/: a service-role client that
// bypasses RLS, since this has to read and push to every subscribed user,
// not just one signed-in caller's own rows.
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

// Deliberately duplicated from src/lib/currency and api/send-bill-
// reminders.ts rather than shared — api/*.ts files in this project are
// kept self-contained from the client bundle by convention.
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

// Same allowlist/rationale as api/send-bill-reminders.ts — real push
// endpoints only ever come from these hosts, so a push_subscriptions row
// pointing anywhere else is rejected rather than ever handed to
// webpush.sendNotification(), which would otherwise make this server an
// SSRF proxy for whatever URL a crafted row supplied.
const ALLOWED_PUSH_ENDPOINT_HOSTS = [
  /(^|\.)googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
];
function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && ALLOWED_PUSH_ENDPOINT_HOSTS.some((re) => re.test(url.hostname));
  } catch {
    return false;
  }
}

function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDaysUTC(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** Same "reserve first" dedupe pattern as api/send-bill-reminders.ts — the
 *  insert itself (not a prior SELECT) is what decides whether this
 *  occurrence is new, so two overlapping cron runs can't both send it. */
async function tryClaim(userId: string, kind: string, dedupeKey: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from("notification_log").insert({ user_id: userId, kind, dedupe_key: dedupeKey });
  if (error) {
    if (error.code !== "23505") console.error("notification_log insert error:", error);
    return false;
  }
  return true;
}

async function undoClaim(userId: string, kind: string, dedupeKey: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("notification_log")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("dedupe_key", dedupeKey);
  if (error) console.error("notification_log rollback error:", error);
}

/** Same per-device send/cleanup behavior as api/send-bill-reminders.ts's
 *  pushToUser — a subscription the push service reports gone (404/410) is
 *  deleted; any other failure is logged and left for a future retry. */
async function pushToUser(userId: string, payload: PushPayload): Promise<boolean> {
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error || !subs?.length) return false;

  let sentAny = false;
  for (const sub of subs) {
    if (!isAllowedPushEndpoint(sub.endpoint)) {
      console.error("Rejected push subscription with disallowed endpoint host:", sub.endpoint);
      await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
      continue;
    }
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

interface DigestProfile {
  id: string;
  currency: string | null;
  digest_frequency: "off" | "weekly" | "monthly";
}

/** Sums expense transactions (negative amounts) in [start, end] (both
 *  inclusive, "YYYY-MM-DD") and finds the single highest-spend category. */
async function summarizeSpending(
  userId: string,
  start: string,
  end: string
): Promise<{ total: number; topCategory: string | null; topAmount: number }> {
  const { data, error } = await supabaseAdmin
    .from("transactions")
    .select("category, amount")
    .eq("user_id", userId)
    .gte("date", start)
    .lte("date", end)
    .lt("amount", 0);
  if (error) {
    console.error(`send-spending-digest: transactions query failed for user ${userId}:`, error);
    return { total: 0, topCategory: null, topAmount: 0 };
  }

  // Keyed by the normalized (trimmed, lowercased) category — same
  // case-insensitive grouping convention as normCategory() in
  // src/utils/dates.ts — but each entry also remembers one real,
  // as-stored spelling to display, so "food" and "Food" contribute to one
  // total instead of splitting it across two lines.
  const byCategory: Record<string, { total: number; label: string }> = {};
  let total = 0;
  for (const t of data ?? []) {
    const spent = Math.abs(Number(t.amount));
    total += spent;
    const label = t.category || "Other";
    const key = label.trim().toLowerCase();
    const entry = byCategory[key] ?? { total: 0, label };
    entry.total += spent;
    byCategory[key] = entry;
  }

  let topCategory: string | null = null;
  let topAmount = 0;
  for (const entry of Object.values(byCategory)) {
    if (entry.total > topAmount) {
      topAmount = entry.total;
      topCategory = entry.label;
    }
  }

  return { total, topCategory, topAmount };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Same Vercel-cron auth pattern as every other job in api/.
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

  const today = todayUTC();
  const results = { weeklySent: 0, monthlySent: 0, failed: 0 };

  try {
    // This job runs daily (see vercel.json) but each cadence only actually
    // fires on its own day — weekly digests go out every Monday (UTC),
    // summarizing the 7 days just finished; monthly digests go out on the
    // 1st of the month, summarizing the calendar month that just ended.
    // Every other day this is a no-op query with nothing to send.
    const isWeeklyDay = today.getUTCDay() === 1; // Monday
    const isMonthlyDay = today.getUTCDate() === 1;

    if (!isWeeklyDay && !isMonthlyDay) {
      res.status(200).json(results);
      return;
    }

    const wanted = [isWeeklyDay ? "weekly" : null, isMonthlyDay ? "monthly" : null].filter(Boolean) as string[];
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("id, currency, digest_frequency")
      .in("digest_frequency", wanted);
    if (profilesError) throw profilesError;

    for (const profile of (profiles ?? []) as DigestProfile[]) {
      let start: string, end: string, kind: string, dedupeKey: string, periodLabel: "week" | "month";

      if (profile.digest_frequency === "weekly") {
        end = dateStr(addDaysUTC(today, -1));
        start = dateStr(addDaysUTC(today, -7));
        kind = "digest_weekly";
        dedupeKey = start; // one send per distinct week-start
        periodLabel = "week";
      } else {
        // "monthly" and running on the 1st: summarize the month that just
        // ended, not the month that just started (which has no data yet).
        const firstOfThisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        const lastOfPrevMonth = addDaysUTC(firstOfThisMonth, -1);
        const firstOfPrevMonth = new Date(Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1));
        start = dateStr(firstOfPrevMonth);
        end = dateStr(lastOfPrevMonth);
        kind = "digest_monthly";
        dedupeKey = start.slice(0, 7); // one send per distinct "YYYY-MM"
        periodLabel = "month";
      }

      const claimed = await tryClaim(profile.id, kind, dedupeKey);
      if (!claimed) continue;

      const { total, topCategory, topAmount } = await summarizeSpending(profile.id, start, end);
      const currency = profile.currency || "USD";
      const body =
        total === 0
          ? `You didn't record any spending this ${periodLabel}.`
          : topCategory
            ? `You spent ${formatAmount(total, currency)} this ${periodLabel}. Top category: ${topCategory} (${formatAmount(topAmount, currency)}).`
            : `You spent ${formatAmount(total, currency)} this ${periodLabel}.`;

      const sent = await pushToUser(profile.id, {
        title: periodLabel === "week" ? "Your weekly spending digest" : "Your monthly spending digest",
        body,
        url: "/spending",
      });

      if (sent) {
        if (kind === "digest_weekly") results.weeklySent++;
        else results.monthlySent++;
      } else {
        // Nothing actually reached this user (no subscription, or every
        // send attempt failed) — undo the claim so the next run for this
        // exact period can try again instead of skipping it forever.
        await undoClaim(profile.id, kind, dedupeKey);
        results.failed++;
      }
    }

    res.status(200).json(results);
  } catch (err) {
    console.error("send-spending-digest error:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}
