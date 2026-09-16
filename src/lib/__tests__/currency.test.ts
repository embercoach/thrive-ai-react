import { describe, it, expect } from "vitest";
import { isOverBudget } from "@/lib/currency";

// Guards against the float-residue class of bug formatMoneySigned was
// already hardened against (see its own comment in currency.ts) — summing
// many transaction floats can leave a tiny residue like 300.0000000001 that
// would fail a strict `amount > budget` for a user who spent exactly their
// limit, showing a false "over budget" alert/banner.
describe("isOverBudget", () => {
  it("is not over when spend exactly equals the budget, float residue included", () => {
    const amount = 0.1 + 0.1 + 0.1 + 299.7; // == 300 in real terms, not in raw float
    expect(isOverBudget(amount, 300)).toBe(false);
  });

  it("is over once spend genuinely exceeds the budget by a real cent", () => {
    expect(isOverBudget(300.01, 300)).toBe(true);
  });

  it("is not over when spend is comfortably under budget", () => {
    expect(isOverBudget(250, 300)).toBe(false);
  });

  it("treats a zero budget as exceeded by any positive spend", () => {
    expect(isOverBudget(0.01, 0)).toBe(true);
    expect(isOverBudget(0, 0)).toBe(false);
  });
});
