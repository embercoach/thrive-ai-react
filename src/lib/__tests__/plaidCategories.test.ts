import { describe, it, expect } from "vitest";
import { mapPlaidCategory } from "@/lib/plaidCategories";

describe("mapPlaidCategory", () => {
  it("maps every one of Plaid's 18 primary categories to a non-empty label", () => {
    const allPrimaries = [
      "INCOME",
      "LOAN_DISBURSEMENTS",
      "LOAN_PAYMENTS",
      "TRANSFER_IN",
      "TRANSFER_OUT",
      "BANK_FEES",
      "ENTERTAINMENT",
      "FOOD_AND_DRINK",
      "GENERAL_MERCHANDISE",
      "HOME_IMPROVEMENT",
      "MEDICAL",
      "PERSONAL_CARE",
      "GENERAL_SERVICES",
      "GOVERNMENT_AND_NON_PROFIT",
      "TRANSPORTATION",
      "TRAVEL",
      "RENT_AND_UTILITIES",
      "OTHER",
    ];
    for (const primary of allPrimaries) {
      expect(mapPlaidCategory(primary)).toBeTruthy();
    }
  });

  it("maps a few specific categories to the expected app-facing label", () => {
    expect(mapPlaidCategory("FOOD_AND_DRINK")).toBe("Food");
    expect(mapPlaidCategory("RENT_AND_UTILITIES")).toBe("Housing");
    expect(mapPlaidCategory("TRANSPORTATION")).toBe("Transport");
    expect(mapPlaidCategory("INCOME")).toBe("Income");
  });

  it("groups both transfer directions and loan disbursements under one label", () => {
    expect(mapPlaidCategory("TRANSFER_IN")).toBe("Transfer");
    expect(mapPlaidCategory("TRANSFER_OUT")).toBe("Transfer");
    expect(mapPlaidCategory("LOAN_DISBURSEMENTS")).toBe("Transfer");
  });

  it("falls back to Other for OTHER, unrecognized, null, and undefined values", () => {
    expect(mapPlaidCategory("OTHER")).toBe("Other");
    expect(mapPlaidCategory("SOME_FUTURE_CATEGORY_PLAID_ADDS_LATER")).toBe("Other");
    expect(mapPlaidCategory(null)).toBe("Other");
    expect(mapPlaidCategory(undefined)).toBe("Other");
  });
});
