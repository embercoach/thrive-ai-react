import { useMemo } from "react";
import type { RecurringItem, Budget, Transaction } from "@/types";
import { parseLocalDate, todayLocal, daysBetween, isSameMonth, normCategory } from "@/utils/dates";
import { isOverBudget } from "@/lib/currency";

export interface BillAlert {
  kind: "bill_due";
  recurringId: string;
  name: string;
  amount: number;
  dueDate: string;
  daysUntil: number;
}

export interface BudgetAlert {
  kind: "budget_over";
  category: string;
  spent: number;
  budget: number;
}

export type Alert = BillAlert | BudgetAlert;

/**
 * Every actionable alert right now, computed entirely from data already
 * loaded — no separate fetch, and (deliberately) no persisted "read" state,
 * so this always reflects the current, real situation rather than a stale
 * notification someone dismissed a week ago. Unlike useHomeBrief's rotating
 * top-4 summary for the Home screen, this returns the full list for the
 * dedicated Notifications page.
 *
 * Budget-over alerts are gated behind `isPro`, matching the same tiering
 * useHomeBrief already applies to its own over-budget line — this doesn't
 * introduce a new distinction, it just keeps the existing one consistent.
 *
 * A plain function (rather than living only inside the hook below) so it's
 * unit-testable without rendering a component — same split as
 * useSpendingData's periodTransactions/matchesTypeFilter.
 */
export function computeAlerts(
  recurring: RecurringItem[],
  budgets: Budget[],
  transactions: Transaction[],
  isPro: boolean
): Alert[] {
  const alerts: Alert[] = [];
  const today = todayLocal();

  const billAlerts: BillAlert[] = recurring
    .filter((r) => r.active !== false)
    .map((r) => ({ r, due: parseLocalDate(r.next_date) }))
    .filter(({ due }) => {
      const d = daysBetween(today, due);
      return d >= 0 && d <= 3;
    })
    .map(({ r, due }) => ({
      kind: "bill_due" as const,
      recurringId: r.id,
      name: r.name,
      amount: Math.abs(r.amount),
      dueDate: r.next_date,
      daysUntil: daysBetween(today, due),
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
  alerts.push(...billAlerts);

  if (isPro) {
    const spentByCategory: Record<string, number> = {};
    transactions
      .filter((t) => isSameMonth(parseLocalDate(t.date), today) && t.amount < 0)
      .forEach((t) => {
        const key = normCategory(t.category);
        spentByCategory[key] = (spentByCategory[key] || 0) + Math.abs(t.amount);
      });

    budgets.forEach((b) => {
      const spent = spentByCategory[normCategory(b.category)] ?? 0;
      if (isOverBudget(spent, b.amount)) {
        alerts.push({ kind: "budget_over", category: b.category, spent, budget: b.amount });
      }
    });
  }

  return alerts;
}

export function useAlerts(
  recurring: RecurringItem[],
  budgets: Budget[],
  transactions: Transaction[],
  isPro: boolean
): Alert[] {
  return useMemo(
    () => computeAlerts(recurring, budgets, transactions, isPro),
    [recurring, budgets, transactions, isPro]
  );
}
