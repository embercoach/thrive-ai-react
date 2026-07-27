import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useAvailableToSpend, useNetWorth } from "@/hooks/useHomeMetrics";
import { parseBreakdown } from "@/lib/parseBreakdown";
import * as api from "@/services/api";
import type { Breakdown } from "@/types";
import { parseLocalDate, todayLocal, isSameMonth } from "@/utils/dates";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  breakdown?: Breakdown | null;
}

const FREE_MONTHLY_QUESTIONS = 3;

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

        const { text, breakdown } = parseBreakdown(data.text as string);
        const assistantMsg: DisplayMessage = { id: `a-${Date.now()}`, role: "assistant", text, breakdown };
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

  return {
    messages,
    loadingHistory,
    sending,
    error,
    send,
    clear,
    questionsUsedThisMonth,
    limitReached,
    freeLimit: FREE_MONTHLY_QUESTIONS,
    isPro,
    profileName: profile?.name,
  };
}
