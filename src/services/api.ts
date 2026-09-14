import { supabase } from "@/services/supabase";
import type { Transaction, Goal, Budget, RecurringItem, Profile, ChatMessage } from "@/types";
import { advanceDate, todayLocalStr } from "@/utils/dates";

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) {
    // PGRST116 = "no rows" — a genuinely missing profile (e.g. the
    // post-signup trigger that creates one hasn't run yet), which callers
    // correctly treat as "not onboarded". Any other error (a dropped
    // connection, a transient Supabase blip) must NOT be collapsed into the
    // same `null` result — OnboardingGate reads a null profile as "show
    // onboarding", so a fully onboarded user hitting a transient fetch
    // error here would otherwise get bounced back into onboarding.
    if (error.code === "PGRST116") return null;
    throw error;
  }
  return data;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }) {
  return supabase.from("profiles").upsert(profile);
}

export async function fetchTransactions(userId: string): Promise<Transaction[]> {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addTransaction(t: Omit<Transaction, "id">) {
  return supabase.from("transactions").insert(t);
}

/**
 * Writes the legs of a split purchase as one insert, so a partial failure
 * can't leave half a split behind — you'd get a shop whose parts no longer
 * add up to what was actually spent.
 */
export async function addTransactionSplit(legs: Omit<Transaction, "id">[]) {
  return supabase.from("transactions").insert(legs);
}

/** Every leg of a split, oldest first, for showing a purchase as a whole. */
export async function fetchSplitGroup(userId: string, splitGroupId: string): Promise<Transaction[]> {
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .eq("split_group_id", splitGroupId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

/** Deletes a whole split at once — deleting one leg of a shop rarely makes sense. */
export async function deleteSplitGroup(userId: string, splitGroupId: string) {
  return supabase
    .from("transactions")
    .delete()
    .eq("user_id", userId)
    .eq("split_group_id", splitGroupId);
}

// Scoped by user_id in addition to id — belt-and-suspenders alongside RLS.
// Without it, this function's own signature doesn't rule out being called
// with an id that belongs to someone else's row; every caller in this app
// only ever sources ids from that user's own fetched data, but the function
// itself should never be the only thing standing between "my id" and "an id
// I supplied."
export async function updateTransaction(userId: string, id: string, patch: Partial<Transaction>) {
  return supabase.from("transactions").update(patch).eq("id", id).eq("user_id", userId);
}

export async function deleteTransaction(userId: string, id: string) {
  return supabase.from("transactions").delete().eq("id", id).eq("user_id", userId);
}

export async function fetchGoals(userId: string): Promise<Goal[]> {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addGoal(g: Omit<Goal, "id">) {
  return supabase.from("goals").insert(g);
}

export async function updateGoal(userId: string, id: string, patch: Partial<Goal>) {
  return supabase.from("goals").update(patch).eq("id", id).eq("user_id", userId);
}

/**
 * Adds `amount` to a goal's `current` atomically, via the
 * `increment_goal_current` Postgres function (see the matching migration).
 * Unlike a plain `updateGoal(userId, id, { current: goal.current + amt })`
 * — which computes the new value from a `goal` snapshot read earlier, on
 * the client — this does the read-and-add as a single database statement,
 * scoped to the caller's own row via `auth.uid()` inside the function
 * itself. That closes a real lost-update race: two contributions to the
 * same goal from two devices (or two tabs) in quick succession, each
 * computing `current + amt` from the same stale snapshot, would otherwise
 * have the second write silently clobber the first instead of stacking on
 * top of it.
 */
export async function contributeToGoal(id: string, amount: number) {
  return supabase.rpc("increment_goal_current", { p_goal_id: id, p_amount: amount });
}

export async function deleteGoal(userId: string, id: string) {
  return supabase.from("goals").delete().eq("id", id).eq("user_id", userId);
}

export async function fetchBudgets(userId: string): Promise<Budget[]> {
  const { data } = await supabase.from("budgets").select("*").eq("user_id", userId);
  return data ?? [];
}

export async function upsertBudget(userId: string, category: string, amount: number) {
  return supabase
    .from("budgets")
    .upsert({ user_id: userId, category, amount }, { onConflict: "user_id,category" });
}

export async function deleteBudget(userId: string, category: string) {
  return supabase.from("budgets").delete().eq("user_id", userId).eq("category", category);
}

export async function fetchRecurring(userId: string): Promise<RecurringItem[]> {
  const { data } = await supabase
    .from("recurring")
    .select("*")
    .eq("user_id", userId)
    .order("next_date", { ascending: true });
  return data ?? [];
}

export async function addRecurring(r: Omit<RecurringItem, "id">) {
  return supabase.from("recurring").insert(r);
}

export async function updateRecurring(userId: string, id: string, patch: Partial<RecurringItem>) {
  return supabase.from("recurring").update(patch).eq("id", id).eq("user_id", userId);
}

export async function deleteRecurring(userId: string, id: string) {
  return supabase.from("recurring").delete().eq("id", id).eq("user_id", userId);
}

// Guards against two overlapping calls in the SAME browser tab both reading
// the same stale next_date and each inserting a transaction for it — the
// race that let React StrictMode's dev-mode double-invoke create duplicate
// Rent and Shopify transactions during testing. This flag is a module-level
// variable, though, so it does nothing across two tabs, two windows, or a
// phone + laptop open on the same account at once — an everyday scenario,
// not a contrived one. The real backstop is the database-level unique index
// from the prevent_duplicate_recurring_transactions migration (on
// (recurring_id, date), only for materialized recurring rows), checked for
// below via its 23505 (unique_violation) error code; this in-tab flag just
// avoids hitting that constraint needlessly on every render.
let processingRecurring = false;

export async function processRecurring(userId: string, currency: string) {
  if (processingRecurring) return;
  processingRecurring = true;
  try {
    const { data: rules } = await supabase
      .from("recurring")
      .select("*")
      .eq("user_id", userId)
      .eq("active", true);
    if (!rules || !rules.length) return;

    // Local, not UTC — a UTC "today" is still yesterday for anyone east of
    // UTC in the small hours, which would defer a bill that is in fact due.
    const today = todayLocalStr();
    for (const r of rules as RecurringItem[]) {
      let next = r.next_date;
      let guard = 0;
      while (next <= today && guard < 60) {
        const { error } = await supabase.from("transactions").insert({
          user_id: userId,
          name: r.name,
          amount: r.amount,
          category: r.category,
          date: next,
          currency: r.currency || currency,
          recurring_id: r.id,
        });
        if (error) {
          // 23505 = unique_violation: another tab/device already
          // materialized this exact occurrence (same recurring_id + date)
          // and won the race — that's success from here, so keep advancing
          // as if this session's own insert had gone through. Any other
          // error means the insert genuinely failed, so stop for this rule
          // rather than advance next_date past an occurrence that was
          // never actually recorded.
          if (error.code !== "23505") break;
        }
        next = advanceDate(next, r.frequency);
        guard++;
        // Persist progress after every insert, not just at the end — if a
        // second call is already queued behind this one, it needs to see
        // the advanced next_date the moment this iteration commits, not
        // after the whole loop finishes.
        if (next !== r.next_date) {
          await supabase.from("recurring").update({ next_date: next }).eq("id", r.id).eq("user_id", userId);
        }
      }
    }
  } finally {
    processingRecurring = false;
  }
}

export async function fetchChatHistory(userId: string): Promise<ChatMessage[]> {
  // Ordering ascending-then-limit(50) returns the OLDEST 50 messages, not
  // the most recent ones — a long-running chat would show the very start of
  // the conversation forever and never surface anything said since. Fetch
  // the newest 50 (descending) instead, then reverse in JS so the caller
  // still gets them in chronological (oldest-first) order for rendering.
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []).reverse();
}

export async function saveChatMessage(userId: string, role: "user" | "assistant", content: string) {
  return supabase.from("chat_messages").insert({ user_id: userId, role, content });
}

export async function clearChatHistory(userId: string) {
  return supabase.from("chat_messages").delete().eq("user_id", userId);
}

export async function submitFeedback(userId: string, email: string, message: string) {
  return supabase.from("feedback").insert({ user_id: userId, email, message });
}
