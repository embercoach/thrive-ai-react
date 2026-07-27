import { useMemo, useState } from "react";
import type { Transaction, Budget } from "@/types";
import { parseLocalDate, normCategory } from "@/utils/dates";
import { categoryColor } from "@/lib/categories";

export type SpendPeriod = "this" | "last";

function periodTransactions(transactions: Transaction[], period: SpendPeriod): Transaction[] {
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
    return d.getMonth() === month && d.getFullYear() === year && t.amount < 0;
  });
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

  const thisTotal = useMemo(() => thisMonthTxns.reduce((a, t) => a + Math.abs(t.amount), 0), [thisMonthTxns]);
  const lastTotal = useMemo(() => lastMonthTxns.reduce((a, t) => a + Math.abs(t.amount), 0), [lastMonthTxns]);

  const shownTxns = period === "this" ? thisMonthTxns : lastMonthTxns;
  const shownTotal = period === "this" ? thisTotal : lastTotal;

  const trendPct =
    period === "this" && lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : null;

  const breakdown: CategoryBreakdown[] = useMemo(() => {
    const byCat: Record<string, number> = {};
    shownTxns.forEach((t) => {
      const cat = t.category || "Other";
      byCat[cat] = (byCat[cat] || 0) + Math.abs(t.amount);
    });
    return Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({
        category,
        amount,
        pct: shownTotal > 0 ? Math.round((amount / shownTotal) * 100) : 0,
        color: categoryColor(category),
      }));
  }, [shownTxns, shownTotal]);

  // Budget cards always reflect THIS month regardless of the toggle above —
  // a budget is inherently a current-month concept.
  const budgetRows: CategoryBudgetRow[] = useMemo(() => {
    const byCat: Record<string, number> = {};
    thisMonthTxns.forEach((t) => {
      const cat = t.category || "Other";
      byCat[cat] = (byCat[cat] || 0) + Math.abs(t.amount);
    });
    return Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => {
        const budget = budgetFor(budgets, category);
        const budgetPct = budget ? Math.min(Math.round((amount / budget) * 100), 999) : 0;
        return {
          category,
          amount,
          pct: thisTotal > 0 ? Math.round((amount / thisTotal) * 100) : 0,
          color: categoryColor(category),
          budget,
          budgetPct,
          over: !!budget && amount > budget,
        };
      });
  }, [thisMonthTxns, thisTotal, budgets]);

  return { period, setPeriod, shownTxns, shownTotal, trendPct, breakdown, budgetRows, thisMonthTxns };
}
