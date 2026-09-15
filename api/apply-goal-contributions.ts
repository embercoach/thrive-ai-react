import type { VercelRequest, VercelResponse } from "@vercel/node";
import { captureApiError } from "./_lib/sentry";
import { createClient } from "@supabase/supabase-js";

// Same pattern as every other cron job in api/: a service-role client that
// bypasses RLS, since this has to read and update every user's goals, not
// just one signed-in caller's own rows.
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Deliberately duplicated from src/utils/dates.ts rather than imported —
// api/*.ts files in this project are kept self-contained from the client
// bundle (see api/chat.ts's own duplicated constants, api/send-bill-
// reminders.ts's own todayUTCStr/addDaysStr). This runs server-side with no
// browser timezone to key off, so it works in UTC throughout, same as
// send-bill-reminders.ts.
function todayUTCStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Advances a "YYYY-MM-DD" date string by one auto-contribution period.
 * Monthly clamps to the target month's real last day (naive month-add
 * overflows "Feb 31" into "Mar 3") — the same logic as
 * src/utils/dates.ts's advanceDate, duplicated here for the reason above.
 */
function advanceDateUTC(dateStr: string, frequency: "weekly" | "biweekly" | "monthly"): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (frequency === "weekly") {
    d.setUTCDate(d.getUTCDate() + 7);
  } else if (frequency === "biweekly") {
    d.setUTCDate(d.getUTCDate() + 14);
  } else {
    const origDay = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const lastDayOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(origDay, lastDayOfMonth));
  }
  return d.toISOString().slice(0, 10);
}

interface DueGoal {
  id: string;
  auto_contribute_amount: number;
  auto_contribute_frequency: "weekly" | "biweekly" | "monthly";
  auto_contribute_next_date: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Same Vercel-cron auth pattern as api/send-bill-reminders.ts and
  // api/plaid-sync.ts — stops anyone who finds this URL from triggering it.
  const expected = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const today = todayUTCStr();
  const results = { checked: 0, applied: 0, failed: 0 };

  try {
    // A stale next_date from someone who hasn't opened the app in a while
    // is caught by `lte`, same reasoning as send-bill-reminders.ts's due-
    // bills query — it applies once for that occurrence and then advances
    // past it, rather than catching up on every missed period at once
    // (which would silently drain far more than the user expected from a
    // goal they haven't looked at in weeks).
    const { data, error: fetchError } = await supabaseAdmin
      .from("goals")
      .select("id, auto_contribute_amount, auto_contribute_frequency, auto_contribute_next_date")
      .not("auto_contribute_amount", "is", null)
      .lte("auto_contribute_next_date", today);
    if (fetchError) throw fetchError;

    const dueGoals = (data ?? []) as DueGoal[];
    results.checked = dueGoals.length;

    for (const goal of dueGoals) {
      const nextDate = advanceDateUTC(today, goal.auto_contribute_frequency);
      // apply_goal_auto_contribution bumps `current` and advances
      // auto_contribute_next_date in one atomic UPDATE (see the migration)
      // so this can never race a manual contribution made from the app at
      // the same moment into a lost update.
      const { error: applyError } = await supabaseAdmin.rpc("apply_goal_auto_contribution", {
        p_goal_id: goal.id,
        p_amount: goal.auto_contribute_amount,
        p_next_date: nextDate,
      });
      if (applyError) {
        console.error(`apply-goal-contributions: failed for goal ${goal.id}:`, applyError);
        results.failed++;
        continue;
      }
      results.applied++;
    }

    res.status(200).json(results);
  } catch (err) {
    console.error("apply-goal-contributions error:", err);
    captureApiError(err, { route: "apply-goal-contributions" });
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}
