import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { RecurringItem, Budget, Transaction } from "@/types";
import { computeAlerts } from "@/hooks/useAlerts";

function bill(overrides: Partial<RecurringItem>): RecurringItem {
  return {
    id: overrides.id ?? Math.random().toString(36),
    user_id: "u1",
    name: "Rent",
    amount: -1000,
    category: "Housing",
    frequency: "monthly",
    next_date: "2026-08-20",
    active: true,
    ...overrides,
  };
}

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

// Fixed "now" so day-distance and month math are deterministic regardless
// of when the suite actually runs.
describe("computeAlerts", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20)); // 20 Aug 2026
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("flags a bill due within 3 days", () => {
    const dueTomorrow = bill({ id: "1", next_date: "2026-08-21" });
    const alerts = computeAlerts([dueTomorrow], [], [], false);
    expect(alerts).toEqual([
      expect.objectContaining({ kind: "bill_due", recurringId: "1", daysUntil: 1 }),
    ]);
  });

  it("ignores a bill more than 3 days out", () => {
    const farOff = bill({ id: "1", next_date: "2026-08-25" });
    expect(computeAlerts([farOff], [], [], false)).toEqual([]);
  });

  it("ignores an inactive bill even if it's due", () => {
    const inactive = bill({ id: "1", next_date: "2026-08-20", active: false });
    expect(computeAlerts([inactive], [], [], false)).toEqual([]);
  });

  it("includes an overdue bill (negative daysUntil is never produced, but 0 is kept)", () => {
    const dueToday = bill({ id: "1", next_date: "2026-08-20" });
    const alerts = computeAlerts([dueToday], [], [], false);
    expect(alerts).toEqual([expect.objectContaining({ recurringId: "1", daysUntil: 0 })]);
  });

  it("sorts multiple due bills soonest-first", () => {
    const in3days = bill({ id: "far", next_date: "2026-08-23" });
    const tomorrow = bill({ id: "near", next_date: "2026-08-21" });
    const alerts = computeAlerts([in3days, tomorrow], [], [], false);
    expect(alerts.map((a) => (a as { recurringId: string }).recurringId)).toEqual(["near", "far"]);
  });

  it("omits budget-over alerts for non-Pro accounts even when over budget", () => {
    const groceries = txn({ category: "Food", amount: -500 });
    const foodBudget: Budget = { category: "Food", amount: 300 };
    expect(computeAlerts([], [foodBudget], [groceries], false)).toEqual([]);
  });

  it("flags an over-budget category for Pro accounts", () => {
    const groceries = txn({ category: "Food", amount: -500 });
    const foodBudget: Budget = { category: "Food", amount: 300 };
    const alerts = computeAlerts([], [foodBudget], [groceries], true);
    expect(alerts).toEqual([
      expect.objectContaining({ kind: "budget_over", category: "Food", spent: 500, budget: 300 }),
    ]);
  });

  it("does not flag a category still under budget", () => {
    const groceries = txn({ category: "Food", amount: -200 });
    const foodBudget: Budget = { category: "Food", amount: 300 };
    expect(computeAlerts([], [foodBudget], [groceries], true)).toEqual([]);
  });

  it("matches budget categories case- and whitespace-insensitively", () => {
    const groceries = txn({ category: " food ", amount: -500 });
    const foodBudget: Budget = { category: "Food", amount: 300 };
    const alerts = computeAlerts([], [foodBudget], [groceries], true);
    expect(alerts).toEqual([expect.objectContaining({ kind: "budget_over", category: "Food" })]);
  });

  it("excludes transactions from a different month from the budget check", () => {
    const lastMonth = txn({ category: "Food", amount: -500, date: "2026-07-15" });
    const foodBudget: Budget = { category: "Food", amount: 300 };
    expect(computeAlerts([], [foodBudget], [lastMonth], true)).toEqual([]);
  });

  it("combines a due bill and an over-budget category together", () => {
    const dueTomorrow = bill({ id: "1", next_date: "2026-08-21" });
    const groceries = txn({ category: "Food", amount: -500 });
    const foodBudget: Budget = { category: "Food", amount: 300 };
    const alerts = computeAlerts([dueTomorrow], [foodBudget], [groceries], true);
    expect(alerts).toHaveLength(2);
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "bill_due" }),
        expect.objectContaining({ kind: "budget_over" }),
      ])
    );
  });
});
