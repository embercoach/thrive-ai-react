import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { Transaction } from "@/types";
import { periodTransactions, matchesTypeFilter } from "@/hooks/useSpendingData";

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? Math.random().toString(36),
    user_id: "u1",
    name: "Test",
    amount: -100,
    category: "Food",
    date: "2026-08-15",
    ...overrides,
  };
}

// Fixed "now" so period math (this month / last month) is deterministic
// regardless of when the suite actually runs.
describe("periodTransactions", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20)); // 20 Aug 2026
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const groceries = txn({ id: "1", name: "Woolworths", amount: -600, date: "2026-08-05" });
  const salary = txn({ id: "2", name: "Salary", amount: 30000, category: "Income", date: "2026-08-01" });
  const lastMonthRent = txn({ id: "3", name: "Rent", amount: -8000, date: "2026-07-01" });
  const all = [groceries, salary, lastMonthRent];

  it("defaults to expenses-only for the current month", () => {
    expect(periodTransactions(all, "this")).toEqual([groceries]);
  });

  it("includes income when expensesOnly is false", () => {
    const result = periodTransactions(all, "this", false);
    expect(result).toHaveLength(2);
    expect(result).toEqual(expect.arrayContaining([groceries, salary]));
  });

  it("scopes to last month separately from this month", () => {
    expect(periodTransactions(all, "last")).toEqual([lastMonthRent]);
    expect(periodTransactions(all, "last", false)).toEqual([lastMonthRent]);
  });
});

describe("matchesTypeFilter", () => {
  const expense = txn({ amount: -50 });
  const income = txn({ amount: 2000 });

  it("\"expense\" keeps only negative amounts", () => {
    expect(matchesTypeFilter(expense, "expense")).toBe(true);
    expect(matchesTypeFilter(income, "expense")).toBe(false);
  });

  it("\"income\" keeps only positive amounts", () => {
    expect(matchesTypeFilter(income, "income")).toBe(true);
    expect(matchesTypeFilter(expense, "income")).toBe(false);
  });

  it("\"all\" keeps everything", () => {
    expect(matchesTypeFilter(expense, "all")).toBe(true);
    expect(matchesTypeFilter(income, "all")).toBe(true);
  });
});
