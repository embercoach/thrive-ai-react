import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useAvailableToSpend, useNetWorth } from "@/hooks/useHomeMetrics";
import { parseBreakdown } from "@/lib/parseBreakdown";
import { parseIntake } from "@/lib/parseIntake";
import * as api from "@/services/api";
import type { Breakdown, IntakeAction } from "@/types";
import { parseLocalDate, todayLocal, isSameMonth } from "@/utils/dates";

export type IntakeStatus = "pending" | "confirming" | "confirmed" | "partial" | "dismissed";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  breakdown?: Breakdown | null;
  intake?: IntakeAction[] | null;
  intakeStatus?: IntakeStatus;
  intakeNote?: string;
}

const FREE_MONTHLY_QUESTIONS = 3;
const MAX_INTAKE_ACTIONS_PER_TURN = 20;
const FREE_RECURRING_LIMIT = 2;
const FREE_GOAL_LIMIT = 2;

export function useChat() {
  const { user } = useAuth();
  const { profile, transactions, goals, budgets, recurring, currency, monthlyIncome, isPro, refetch } = useAppData();
  const availableToSpend = useAvailableToSpend(transactions, recurring);
  const netWorth = useNetWorth(transactions);

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .fetchChatHistory(user.id)
      .then((history) => {
        setMessages(
          history.map((m, i) => {
            const { text, breakdown } = parseBreakdown(m.content);
            return { id: m.id ?? `hist-${i}`, role: m.role, text, breakdown };
          })
        );
      })
      .catch(() => {
        // History failing to load shouldn't block the user from starting a
        // fresh conversation — worst case they lose sight of past messages
        // for this session, not the ability to use the Advisor at all.
        setMessages([]);
      })
      .finally(() => setLoadingHistory(false));
  }, [user]);

  const currentMonthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const questionsUsedThisMonth =
    profile?.ai_questions_month === currentMonthKey ? profile?.ai_questions_count ?? 0 : 0;
  const limitReached = !isPro && questionsUsedThisMonth >= FREE_MONTHLY_QUESTIONS;

  const context = useMemo(() => {
    const today = todayLocal();
    const byCat: Record<string, number> = {};
    transactions
      .filter((t) => isSameMonth(parseLocalDate(t.date), today) && t.amount < 0)
      .forEach((t) => {
        const cat = t.category || "Other";
        byCat[cat] = (byCat[cat] || 0) + Math.abs(t.amount);
      });
    const spendingByCategory = Object.entries(byCat).map(([category, amount]) => ({
      category,
      amount,
      budget: budgets.find((b) => b.category === category)?.amount,
    }));

    return {
      currency,
      monthlyIncome,
      netWorth,
      availableToSpend,
      spendingByCategory,
      goals: goals.map((g) => ({ name: g.name, current: g.current, target: g.target })),
      upcomingBills: recurring
        .filter((r) => r.active !== false)
        .slice(0, 8)
        .map((r) => ({ name: r.name, amount: r.amount, dueDate: r.next_date })),
      recentTransactions: transactions.slice(0, 15).map((t) => ({
        name: t.name,
        amount: t.amount,
        category: t.category,
        date: t.date,
      })),
    };
  }, [transactions, goals, budgets, recurring, currency, monthlyIncome, netWorth, availableToSpend]);

  const send = useCallback(
    async (userText: string) => {
      if (!user || !userText.trim() || sending) return;
      if (limitReached) {
        setError("You've used your 3 free questions this month. Upgrade to Pro for unlimited access.");
        return;
      }
      setError("");
      setSending(true);

      const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: "user", text: userText.trim() };
      setMessages((prev) => [...prev, userMsg]);
      await api.saveChatMessage(user.id, "user", userText.trim());

      try {
        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.text,
        }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history, context }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Something went wrong");

        const { text: textAfterBreakdown, breakdown } = parseBreakdown(data.text as string);
        const { text, intake } = parseIntake(textAfterBreakdown);

        let actions = intake?.actions ?? null;
        let intakeNote: string | undefined;
        if (actions && actions.length > MAX_INTAKE_ACTIONS_PER_TURN) {
          actions = actions.slice(0, MAX_INTAKE_ACTIONS_PER_TURN);
          intakeNote = `Showing the first ${MAX_INTAKE_ACTIONS_PER_TURN} items — ask me to add the rest separately.`;
        }

        const assistantMsg: DisplayMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text,
          breakdown,
          intake: actions,
          intakeStatus: actions ? "pending" : undefined,
          intakeNote,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        await api.saveChatMessage(user.id, "assistant", data.text as string);

        if (!isPro) {
          await api.upsertProfile({
            id: user.id,
            ai_questions_month: currentMonthKey,
            ai_questions_count: questionsUsedThisMonth + 1,
          });
          await refetch();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      } finally {
        setSending(false);
      }
    },
    [user, sending, limitReached, messages, context, isPro, questionsUsedThisMonth, currentMonthKey, refetch]
  );

  const clear = useCallback(async () => {
    if (!user) return;
    await api.clearChatHistory(user.id);
    setMessages([]);
  }, [user]);

  // Confirms a proposed THRIVE_INTAKE batch by actually writing it to
  // Supabase, via the exact same client-side api.* calls (and the same
  // RLS-protected anon Supabase client) the Add modals already use — nothing
  // is saved until the user taps confirm here. Sequential, not Promise.all,
  // so the running recurring/goal counters below correctly gate the
  // free-plan caps item-by-item within one batch instead of every write
  // reading the same stale count.
  const confirmIntake = useCallback(
    async (messageId: string, onNeedUpgrade: (reason: string) => void) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!user || !msg?.intake || msg.intakeStatus === "confirming" || msg.intakeStatus === "confirmed") return;

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, intakeStatus: "confirming" } : m)));

      const todayStr = new Date().toISOString().split("T")[0];
      let recurringCount = recurring.length;
      let goalCount = goals.length;
      let savedCount = 0;
      let upgradeBlockedCount = 0;
      let failedCount = 0;
      let hitRecurringCap = false;
      let hitGoalCap = false;

      for (const action of msg.intake) {
        try {
          switch (action.type) {
            case "transaction": {
              if (!action.name || typeof action.amount !== "number") {
                failedCount++;
                continue;
              }
              const { error } = await api.addTransaction({
                user_id: user.id,
                name: action.name,
                amount: action.amount,
                category: action.category?.trim() || "Other",
                date: action.date || todayStr,
                currency,
              });
              if (error) failedCount++;
              else savedCount++;
              break;
            }
            case "recurring": {
              if (!action.name || typeof action.amount !== "number") {
                failedCount++;
                continue;
              }
              if (!isPro && recurringCount >= FREE_RECURRING_LIMIT) {
                upgradeBlockedCount++;
                hitRecurringCap = true;
                continue;
              }
              const { error } = await api.addRecurring({
                user_id: user.id,
                name: action.name,
                amount: action.amount,
                category: action.category?.trim() || "Other",
                currency,
                frequency: action.frequency || "monthly",
                next_date: action.next_date || todayStr,
                active: true,
              });
              if (error) {
                failedCount++;
              } else {
                savedCount++;
                recurringCount++;
              }
              break;
            }
            case "goal": {
              if (!action.name || typeof action.target !== "number") {
                failedCount++;
                continue;
              }
              if (!isPro && goalCount >= FREE_GOAL_LIMIT) {
                upgradeBlockedCount++;
                hitGoalCap = true;
                continue;
              }
              const { error } = await api.addGoal({
                user_id: user.id,
                name: action.name,
                target: Math.abs(action.target),
                current: Math.abs(action.current || 0),
                deadline: null,
              });
              if (error) {
                failedCount++;
              } else {
                savedCount++;
                goalCount++;
              }
              break;
            }
            case "monthly_income": {
              if (typeof action.amount !== "number") {
                failedCount++;
                continue;
              }
              const { error } = await api.upsertProfile({ id: user.id, monthly_income: Math.abs(action.amount) });
              if (error) failedCount++;
              else savedCount++;
              break;
            }
          }
        } catch {
          failedCount++;
        }
      }

      await refetch();

      const noteParts: string[] = [];
      if (upgradeBlockedCount > 0) {
        noteParts.push(`${upgradeBlockedCount} item${upgradeBlockedCount > 1 ? "s" : ""} need${upgradeBlockedCount > 1 ? "" : "s"} Pro to add`);
      }
      if (failedCount > 0) noteParts.push(`${failedCount} failed to save`);
      const note = noteParts.length
        ? `${savedCount} saved. ${noteParts.join(", ")}.`
        : `${savedCount} item${savedCount === 1 ? "" : "s"} added to your account.`;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, intakeStatus: upgradeBlockedCount > 0 || failedCount > 0 ? "partial" : "confirmed", intakeNote: note }
            : m
        )
      );

      if (hitRecurringCap) onNeedUpgrade("recurring transactions");
      else if (hitGoalCap) onNeedUpgrade("goals");
    },
    [user, messages, recurring.length, goals.length, isPro, currency, refetch]
  );

  const dismissIntake = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, intakeStatus: "dismissed" } : m)));
  }, []);

  return {
    messages,
    loadingHistory,
    sending,
    error,
    send,
    clear,
    confirmIntake,
    dismissIntake,
    questionsUsedThisMonth,
    limitReached,
    freeLimit: FREE_MONTHLY_QUESTIONS,
    isPro,
    profileName: profile?.name,
  };
}
