import type { Transaction } from "@/types";

/**
 * Wraps a field in double quotes and escapes any inner quotes, but only
 * when the field actually needs it (contains a comma, quote, or newline).
 * Leaving plain fields unquoted keeps the output readable when opened in a
 * text editor, while still round-tripping correctly through Excel/Sheets.
 */
function csvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const HEADERS = ["Date", "Merchant", "Category", "Type", "Amount", "Account", "Notes"];

/**
 * One row per transaction, sorted oldest-first (the order a bank statement
 * or accounting import would expect). Amount keeps its original sign
 * (negative = expense, positive = income) rather than splitting into
 * separate debit/credit columns — that matches how the app already stores
 * and displays every other amount, so a re-import would need no translation.
 */
export function transactionsToCsv(transactions: Transaction[]): string {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const rows = sorted.map((t) =>
    [
      t.date,
      csvField(t.name),
      csvField(t.category || "Other"),
      t.amount < 0 ? "Expense" : "Income",
      t.amount.toFixed(2),
      csvField(t.account || ""),
      csvField(t.notes || ""),
    ].join(",")
  );
  // A leading UTF-8 BOM makes Excel on Windows detect the encoding
  // correctly instead of mangling any non-ASCII merchant names/notes.
  return "﻿" + [HEADERS.join(","), ...rows].join("\r\n");
}

/** Triggers a browser download of `content` as a file named `filename`. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
