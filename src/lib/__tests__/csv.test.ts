import { describe, it, expect } from "vitest";
import { transactionsToCsv } from "@/lib/csv";
import type { Transaction } from "@/types";

function txn(overrides: Partial<Transaction>): Transaction {
  return {
    id: "1",
    user_id: "u1",
    name: "Woolworths",
    amount: -125.5,
    category: "Food",
    date: "2026-08-10",
    ...overrides,
  };
}

describe("transactionsToCsv", () => {
  it("emits a header row and one row per transaction, oldest first", () => {
    const csv = transactionsToCsv([
      txn({ id: "2", date: "2026-08-15", name: "Salary", amount: 5000, category: "Income" }),
      txn({ id: "1", date: "2026-08-01", name: "Rent", amount: -1200, category: "Housing" }),
    ]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[0]).toBe("Date,Merchant,Category,Type,Amount,Account,Notes");
    // Oldest (2026-08-01) comes before the later one, regardless of input order.
    expect(lines[1]).toBe("2026-08-01,Rent,Housing,Expense,-1200.00,,");
    expect(lines[2]).toBe("2026-08-15,Salary,Income,Income,5000.00,,");
  });

  it("prefixes with a UTF-8 BOM so Excel reads non-ASCII text correctly", () => {
    const csv = transactionsToCsv([txn({})]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("quotes and escapes fields containing commas or quotes", () => {
    const csv = transactionsToCsv([txn({ name: 'Trader Joe\'s, "Downtown"' })]);
    const dataLine = csv.replace(/^﻿/, "").split("\r\n")[1];
    expect(dataLine).toContain('"Trader Joe\'s, ""Downtown"""');
  });

  it("falls back to \"Other\" for a missing category", () => {
    const csv = transactionsToCsv([txn({ category: "" })]);
    const dataLine = csv.replace(/^﻿/, "").split("\r\n")[1];
    expect(dataLine).toContain(",Other,");
  });

  it("labels a positive amount Income and a negative amount Expense", () => {
    const csv = transactionsToCsv([
      txn({ id: "1", amount: 50 }),
      txn({ id: "2", amount: -50 }),
    ]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[1]).toContain(",Income,50.00,");
    expect(lines[2]).toContain(",Expense,-50.00,");
  });

  it("neutralizes a leading formula-trigger character so it can't execute as a live formula on open", () => {
    const csv = transactionsToCsv([
      txn({ id: "1", name: '=HYPERLINK("http://evil.example","click me")' }),
      txn({ id: "2", name: "+1+1", category: "-CMD('calc')", account: "@SUM(A1)", notes: "-5 owed" }),
    ]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    // Still quoted/escaped as normal (this field also contains commas and
    // quotes), but now with a leading apostrophe forcing it to plain text.
    expect(lines[1]).toContain('"\'=HYPERLINK(""http://evil.example"",""click me"")"');
    expect(lines[2]).toBe("2026-08-10,'+1+1,'-CMD('calc'),Expense,-125.50,'@SUM(A1),'-5 owed");
  });

  it("leaves ordinary fields (including a negative Amount, which is never user text) untouched", () => {
    const csv = transactionsToCsv([txn({ name: "Groceries", amount: -50 })]);
    const dataLine = csv.replace(/^﻿/, "").split("\r\n")[1];
    expect(dataLine.startsWith("2026-08-10,Groceries,")).toBe(true);
    expect(dataLine).toContain(",-50.00,");
  });
});
