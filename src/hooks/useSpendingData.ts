import { useMemo, useState } from "react";
import type { Transaction, Budget } from "@/types";
import { parseLocalDate, normCategory } from "@/utils/dates";
import { categoryColor } from "@/lib/categories";
import { isOverBudget } from "@/lib/currency";

export type SpendPeriod = "this" | "last";
export type TxnTypeFilter = "expense" | "income" | "all";

/**
 * Transactions falling in the given month. `expensesOnly` defaults to true
 * because every existing caller (totals, breakdown, budgets) is a spending
 * figure, which by definition excludes income rows. The transaction list at
 * the bottom of the Spending page is the one place that needs income visible
 * too (via the type filter), so it opts out explicitly.
 */
export function periodTransactions(
  transactions: Transaction[],
  period: SpendPeriod,
  expensesOnly = true
): Transaction[] {
  const now = new Date();
  let month = now.getMonth();
  let year = now.getFullYear();
  if (period === "last") {
    month -= 1;
    if (month < 0) {
      month = 11;
      year -= 1;
    }
  }
  return transactions.filter((t) => {
    const d = parseLocalDate(t.date);
    return d.getMonth() === month && d.getFullYear() === year && (!expensesOnly || t.amount < 0);
  });
}

/** True if a transaction matches a type filter — shared by the Spending page filter row. */
export function matchesTypeFilter(t: Transaction, typeFilter: TxnTypeFilter): boolean {
  if (typeFilter === "all") return true;
  return typeFilter === "income" ? t.amount > 0 : t.amount < 0;
}

export function budgetFor(budgets: Budget[], category: string): number | undefined {
  return budgets.find((b) => normCategory(b.category) === normCategory(category))?.amount;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  pct: number;
  color: string;
}

export interface CategoryBudgetRow extends CategoryBreakdown {
  budget?: number;
  budgetPct: number;
  over: boolean;
}

export function useSpendingData(transactions: Transaction[], budgets: Budget[]) {
  const [period, setPeriod] = useState<SpendPeriod>("this");

  const thisMonthTxns = useMemo(() => periodTransactions(transactions, "this"), [transactions]);
  const lastMonthTxns = useMemo(() => periodTransactions(transactions, "last"), [transactions]);

  // Same month windows, but income rows included — only the transaction list's
  // type filter needs these; totals/breakdown/budgets stay expenses-only above.
  const thisMonthAllTxns = useMemo(() => periodTransactions(transactions, "this", false), [transactions]);
  const lastMonthAllTxns = useMemo(() => periodTransactions(transactions, "last", false), [transactions]);

  const thisTotal = useMemo(() => thisMonthTxns.reduce((a, t) => a + Math.abs(t.amount), 0), [thisMonthTxns]);
  const lastTotal = useMemo(() => lastMonthTxns.reduce((a, t) => a + Math.abs(t.amount), 0), [lastMonthTxns]);

  const shownTxns = period === "this" ? thisMonthTxns : lastMonthTxns;
  const shownAllTxns = period === "this" ? thisMonthAllTxns : lastMonthAllTxns;
  const shownTotal = period === "this" ? thisTotal : lastTotal;

  const trendPct =
    period === "this" && lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : null;

  // Grouped by normCategory (a case-insensitive key) rather than the raw
  // category string, with the first-seen casing kept as the display label.
  // budgetFor already matches case-insensitively, so grouping by the raw
  // string here used to let "groceries" and "Groceries" show as two separate
  // rows even though they resolve to the same budget.
  const breakdown: CategoryBreakdown[] = useMemo(() => {
    const byCat: Record<string, { label: string; amount: number }> = {};
    shownTxns.forEach((t) => {
      const cat = t.category || "Other";
      const key = normCategory(cat);
      const entry = byCat[key] ?? { label: cat, amount: 0 };
      entry.amount += Math.abs(t.amount);
      byCat[key] = entry;
    });
    return Object.values(byCat)
      .sort((a, b) => b.amount - a.amount)
      .map(({ label, amount }) => ({
        category: label,
        amount,
        pct: shownTotal > 0 ? Math.round((amount / shownTotal) * 100) : 0,
        color: categoryColor(label),
      }));
  }, [shownTxns, shownTotal]);

  // Budget cards always reflect THIS month regardless of the toggle above —
  // a budget is inherently a current-month concept. Same normalized-grouping
  // reasoning as breakdown above; the budgets.forEach merge-in step also now
  // checks the normalized key so it doesn't add a duplicate zero-amount
  // phantom row for a budget whose casing merely differs from a transaction's.
  const budgetRows: CategoryBudgetRow[] = useMemo(() => {
    const byCat: Record<string, { label: string; amount: number }> = {};
    thisMonthTxns.forEach((t) => {
      const cat = t.category || "Other";
      const key = normCategory(cat);
      const entry = byCat[key] ?? { label: cat, amount: 0 };
      entry.amount += Math.abs(t.amount);
      byCat[key] = entry;
    });
    budgets.forEach((b) => {
      const key = normCategory(b.category);
      if (!(key in byCat)) {
        byCat[key] = { label: b.category, amount: 0 };
      }
    });
    return Object.values(byCat)
      .sort((a, b) => b.amount - a.amount)
      .map(({ label, amount }) => {
        const budget = budgetFor(budgets, label);
        const budgetPct = budget ? Math.min(Math.round((amount / budget) * 100), 999) : 0;
        return {
          category: label,
          amount,
          pct: thisTotal > 0 ? Math.round((amount / thisTotal) * 100) : 0,
          color: categoryColor(label),
          budget,
          budgetPct,
          over: !!budget && isOverBudget(amount, budget),
        };
      });
  }, [thisMonthTxns, thisTotal, budgets]);

  return { period, setPeriod, shownTxns, shownAllTxns, shownTotal, trendPct, breakdown, budgetRows, thisMonthTxns };
}