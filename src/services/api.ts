import { supabase } from "@/services/supabase";
import type { Transaction, Goal, Budget, RecurringItem, Profile, ChatMessage } from "@/types";
import { advanceDate, todayLocalStr } from "@/utils/dates";

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
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

export async function updateTransaction(id: string, patch: Partial<Transaction>) {
  return supabase.from("transactions").update(patch).eq("id", id);
}

export async function deleteTransaction(id: string) {
  return supabase.from("transactions").delete().eq("id", id);
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

export async function updateGoal(id: string, patch: Partial<Goal>) {
  return supabase.from("goals").update(patch).eq("id", id);
}

export async function deleteGoal(id: string) {
  return supabase.from("goals").delete().eq("id", id);
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

export async function updateRecurring(id: string, patch: Partial<RecurringItem>) {
  return supabase.from("recurring").update(patch).eq("id", id);
}

export async function deleteRecurring(id: string) {
  return supabase.from("recurring").delete().eq("id", id);
}

// Guards against two overlapping calls both reading the same stale
// next_date and each inserting a transaction for it — the exact race that
// let React StrictMode's dev-mode double-invoke create duplicate Rent and
// Shopify transactions during testing. A real fix belongs at the database
// level (a unique constraint or a Postgres advisory lock), but this closes
// the client-side race for now: only one processRecurring call runs at a
// time per browser tab, and a second call while one is in flight is a no-op.
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
        await supabase.from("transactions").insert({
          user_id: userId,
          name: r.name,
          amount: r.amount,
          category: r.category,
          date: next,
          currency: r.currency || currency,
          recurring_id: r.id,
        });
        next = advanceDate(next, r.frequency);
        guard++;
        // Persist progress after every insert, not just at the end — if a
        // second call is already queued behind this one, it needs to see
        // the advanced next_date the moment this iteration commits, not
        // after the whole loop finishes.
        if (next !== r.next_date) {
          await supabase.from("recurring").update({ next_date: next }).eq("id", r.id);
        }
      }
    }
  } finally {
    processingRecurring = false;
  }
}

export async function fetchChatHistory(userId: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(50);
  return data ?? [];
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
