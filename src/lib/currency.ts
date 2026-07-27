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

/** Compact formatted amount for axis labels, e.g. "$2.4k". */
export function formatMoneyCompact(amount: number, currency: string = "USD"): string {
  const c = currencyConfig(currency);
  const v = Math.abs(Number(amount) || 0);
  if (v >= 1000) return c.symbol + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k";
  return c.symbol + Math.round(v);
}
