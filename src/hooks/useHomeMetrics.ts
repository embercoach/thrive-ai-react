import { useMemo } from "react";
import type { Transaction, Goal, RecurringItem, Budget } from "@/types";
import { parseLocalDate, todayLocal, daysBetween, isSameMonth, isSameDay, normCategory } from "@/utils/dates";
import { formatMoney } from "@/lib/currency";
import type { LucideIcon } from "lucide-react";
import { Clock, TrendingDown, TrendingUp, AlertTriangle, PiggyBank, Trophy, Target } from "lucide-react";

export interface BriefLine {
  text: string;
  icon: LucideIcon;
  tone: "positive" | "negative" | "warning";
}

function budgetFor(budgets: Budget[], category: string): number | undefined {
  const key = budgets.find((b) => normCategory(b.category) === normCategory(category));
  return key?.amount;
}

/** Total balance minus bills due in the next 7 days. Deliberately does NOT
 * subtract remaining budget too — that would double-count against what
 * Spending already shows. This is a spendable-cash number, not a budget one. */
export function useAvailableToSpend(transactions: Transaction[], recurring: RecurringItem[]) {
  return useMemo(() => {
    const balance = transactions.reduce((a, t) => a + Number(t.amount), 0);
    const today = todayLocal();
    const in7 = new Date(today.getTime() + 7 * 86400000);
    const upcoming = recurring
      .filter((r) => r.active !== false && r.amount < 0)
      .reduce((sum, r) => {
        const due = parseLocalDate(r.next_date);
        return due >= today && due <= in7 ? sum + Math.abs(r.amount) : sum;
      }, 0);
    return balance - upcoming;
  }, [transactions, recurring]);
}

export function useNetWorth(transactions: Transaction[]) {
  return useMemo(() => transactions.reduce((a, t) => a + Number(t.amount), 0), [transactions]);
}

/** 7-day running balance, used by both the sparkline and the trend pill. */
export function useSparklinePoints(transactions: Transaction[]) {
  return useMemo(() => {
    if (transactions.length < 2) return [];
    const sorted = [...transactions].sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());
    const today = todayLocal();
    const points: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i, 23, 59, 59);
      const total = sorted
        .filter((t) => parseLocalDate(t.date) <= d)
        .reduce((a, t) => a + Number(t.amount), 0);
      points.push(total);
    }
    return points;
  }, [transactions]);
}

/** Today's Brief — templated from data already loaded, not a live model
 * call. Same instant-answer-layer reasoning as the rest of the app: most
 * day-to-day questions are a data query wearing natural language. */
export function useHomeBrief(
  transactions: Transaction[],
  goals: Goal[],
  recurring: RecurringItem[],
  budgets: Budget[],
  monthlyIncome: number,
  isPro: boolean,
  currency: string = "USD"
): BriefLine[] {
  return useMemo(() => {
    const lines: BriefLine[] = [];
    const today = todayLocal();

    const nearGoal = goals
      .map((g) => ({ g, pct: Math.round((g.current / g.target) * 100) }))
      .filter((x) => x.pct >= 50)
      .sort((a, b) => b.pct - a.pct)[0];
    if (nearGoal) {
      const tier = nearGoal.pct >= 100 ? 100 : nearGoal.pct >= 75 ? 75 : 50;
      lines.push(
        tier === 100
          ? { text: `You hit your "${nearGoal.g.name}" goal — ${formatMoney(nearGoal.g.target, currency)} saved. Incredible work.`, icon: Trophy, tone: "positive" }
          : { text: `You're ${tier}% of the way to "${nearGoal.g.name}". Only ${formatMoney(nearGoal.g.target - nearGoal.g.current, currency)} to go.`, icon: Target, tone: "positive" }
      );
    }

    const dueSoon = recurring
      .filter((r) => r.active !== false)
      .map((r) => ({ ...r, due: parseLocalDate(r.next_date) }))
      .filter((r) => {
        const d = daysBetween(today, r.due);
        return d >= 0 && d <= 3;
      })
      .sort((a, b) => a.due.getTime() - b.due.getTime())[0];
    if (dueSoon) {
      const d = daysBetween(today, dueSoon.due);
      const when = d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`;
      lines.push({ text: `${dueSoon.name} is due ${when} — ${formatMoney(Math.abs(dueSoon.amount), currency)}.`, icon: Clock, tone: "warning" });
    }

    const dayOfMonth = today.getDate();
    const spentThisMonth = transactions
      .filter((t) => isSameMonth(parseLocalDate(t.date), today) && t.amount < 0)
      .reduce((a, t) => a + Math.abs(t.amount), 0);
    if (dayOfMonth > 1 && spentThisMonth > 0) {
      const avgDaily = spentThisMonth / dayOfMonth;
      const yesterday = new Date(today.getTime() - 86400000);
      const spentYesterday = transactions
        .filter((t) => isSameDay(parseLocalDate(t.date), yesterday) && t.amount < 0)
        .reduce((a, t) => a + Math.abs(t.amount), 0);
      const diff = avgDaily - spentYesterday;
      if (Math.abs(diff) > 1) {
        lines.push(
          diff > 0
            ? { text: `You spent ${formatMoney(diff, currency)} less than usual yesterday.`, icon: TrendingDown, tone: "positive" }
            : { text: `You spent ${formatMoney(Math.abs(diff), currency)} more than usual yesterday.`, icon: TrendingUp, tone: "negative" }
        );
      }
    }

    if (isPro) {
      const byCat: Record<string, number> = {};
      transactions
        .filter((t) => isSameMonth(parseLocalDate(t.date), today) && t.amount < 0)
        .forEach((t) => {
          const cat = t.category || "Other";
          byCat[cat] = (byCat[cat] || 0) + Math.abs(t.amount);
        });
      const over = Object.entries(byCat).find(([cat, amt]) => {
        const b = budgetFor(budgets, cat);
        return b && amt > b;
      });
      if (over) {
        const b = budgetFor(budgets, over[0])!;
        lines.push({ text: `${over[0]} is over budget by ${formatMoney(over[1] - b, currency)}.`, icon: AlertTriangle, tone: "negative" });
      }
    }

    const income =
      monthlyIncome > 0
        ? monthlyIncome
        : transactions
            .filter((t) => isSameMonth(parseLocalDate(t.date), today) && t.amount > 0)
            .reduce((a, t) => a + t.amount, 0);
    if (income > 0) {
      const rate = Math.round(((income - spentThisMonth) / income) * 100);
      if (rate >= 40) {
        lines.push({ text: `Outstanding month — you're saving ${rate}% of your income. Future you says thank you.`, icon: PiggyBank, tone: "positive" });
      } else if (rate >= 0) {
        lines.push({ text: `You're on track to save ${rate}% of your income this month.`, icon: PiggyBank, tone: "positive" });
      }
    }

    return lines.slice(0, 4);
  }, [transactions, goals, recurring, budgets, monthlyIncome, isPro, currency]);
}
