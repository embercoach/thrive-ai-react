import type { CurrencyCode, CurrencyConfig } from "@/types";

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { symbol: "$", locale: "en-US", label: "US Dollar (USD)" },
  ZAR: { symbol: "R", locale: "en-ZA", label: "South African Rand (ZAR)" },
  EUR: { symbol: "€", locale: "en-IE", label: "Euro (EUR)" },
  GBP: { symbol: "£", locale: "en-GB", label: "British Pound (GBP)" },
  AUD: { symbol: "A$", locale: "en-AU", label: "Australian Dollar (AUD)" },
  CAD: { symbol: "C$", locale: "en-CA", label: "Canadian Dollar (CAD)" },
  INR: { symbol: "₹", locale: "en-IN", label: "Indian Rupee (INR)" },
  NGN: { symbol: "₦", locale: "en-NG", label: "Nigerian Naira (NGN)" },
};

export function currencyConfig(code: string): CurrencyConfig {
  return CURRENCIES[code as CurrencyCode] ?? CURRENCIES.USD;
}

/**
 * Whether `amount` exceeds `budget`, rounding both to cents first — same
 * technique as formatMoneySigned's sign check. Summing many transaction
 * floats can leave a tiny residue like 300.0000000001 that would otherwise
 * fail a strict `amount > budget` for a user who spent exactly their limit,
 * showing a "$0.00 over budget" alert/banner for spending that isn't
 * actually over. Centralized here so every budget-over check (Home banner,
 * spending breakdown, alerts) rounds the same way.
 */
export function isOverBudget(amount: number, budget: number): boolean {
  return Math.round(amount * 100) > Math.round(budget * 100);
}

/** Full formatted amount, e.g. "$1,302.76" — always positive/absolute. */
export function formatMoney(amount: number, currency: string = "USD"): string {
  const c = currencyConfig(currency);
  return (
    c.symbol +
    Math.abs(Number(amount) || 0).toLocaleString(c.locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

/**
 * Like formatMoney, but keeps a leading "−" for negative values. Use this
 * wherever a figure can legitimately go below zero and the sign is the whole
 * point — a balance, a net total — since plain formatMoney is absolute and
 * would render an overdrawn −$1,070 as a healthy-looking "$1,070.00".
 */
export function formatMoneySigned(amount: number, currency: string = "USD"): string {
  const n = Number(amount) || 0;
  // Round to cents before checking the sign — summing many transaction
  // floats (useNetWorth, useAvailableToSpend) can leave a tiny negative
  // residue like -0.001 that would otherwise pass `n < 0` and print a "−"
  // in front of an amount that rounds to $0.00, showing a negative-looking
  // balance for what's effectively zero.
  const rounded = Math.round(n * 100) / 100;
  return (rounded < 0 ? "−" : "") + formatMoney(rounded, currency);
}

/** Compact formatted amount for axis labels, e.g. "$2.4k". */
export function formatMoneyCompact(amount: number, currency: string = "USD"): string {
  const c = currencyConfig(currency);
  const v = Math.abs(Number(amount) || 0);
  if (v >= 1000) return c.symbol + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k";
  return c.symbol + Math.round(v);
}
