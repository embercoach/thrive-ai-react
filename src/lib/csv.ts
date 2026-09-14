import type { Transaction } from "@/types";

/**
 * Wraps a field in double quotes and escapes any inner quotes, but only
 * when the field actually needs it (contains a comma, quote, or newline).
 * Leaving plain fields unquoted keeps the output readable when opened in a
 * text editor, while still round-tripping correctly through Excel/Sheets.
 *
 * Also neutralizes CSV/formula injection: a field starting with =, +, -, or
 * @ is read as a live formula (not plain text) by Excel, Sheets, and
 * LibreOffice when the file is reopened — a transaction name of
 * `=HYPERLINK("http://evil.example","click")` or a notes field starting
 * with `@SUM(...)` would execute on open rather than just display. Only
 * `name`, `category`, `account`, and `notes` ever reach this function with
 * free-text a user typed; `date`, `type`, and `amount` below are built from
 * validated/computed values and never touch it. A leading apostrophe is
 * Excel's own "force text" marker, so it neutralizes the formula in every
 * spreadsheet app without changing how the field reads in a plain editor.
 *
 * The quoting check itself covers `\r` as well as `\n` — a bare carriage
 * return with neither a comma nor a quote nearby would otherwise slip
 * through unquoted, and every spreadsheet app treats a standalone `\r` as
 * a line break just like `\n`, silently splitting that one field's row in
 * two when the file is reopened. `name` in particular isn't only ever
 * typed through this app's own `<input>` (which strips `\r`/`\n` itself) —
 * it can also arrive verbatim from an AI chat/receipt-scan intake action
 * (see src/hooks/useChat.ts's confirmIntake) or a Plaid-synced merchant
 * name, neither of which passes through that input stripping.
 */
function csvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
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
