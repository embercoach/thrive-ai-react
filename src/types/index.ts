export interface Transaction {
  id: string;
  user_id: string;
  name: string;
  amount: number; // positive = income, negative = expense
  category: string;
  date: string; // YYYY-MM-DD
  currency?: string;
  recurring_id?: string | null;
  created_at?: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target: number;
  current: number;
  deadline?: string | null;
  created_at?: string;
}

export interface Budget {
  category: string;
  amount: number;
}

export interface RecurringItem {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  currency?: string;
  frequency: "monthly" | "weekly";
  next_date: string;
  active: boolean;
}

export interface Profile {
  id: string;
  name?: string;
  email?: string;
  monthly_income?: number;
  currency?: string;
  is_pro?: boolean;
  ai_questions_count?: number;
  ai_questions_month?: string;
  /** Set once the user finishes (or skips through) first-run setup. A flag
   *  rather than inferring from whether data exists — inference would re-show
   *  onboarding forever to anyone who skipped every step. */
  onboarded?: boolean;
}

export type CurrencyCode =
  | "USD"
  | "ZAR"
  | "EUR"
  | "GBP"
  | "AUD"
  | "CAD"
  | "INR"
  | "NGN";

export interface CurrencyConfig {
  symbol: string;
  locale: string;
  label: string;
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

export interface BreakdownItem {
  label: string;
  amount: number;
  category: string;
}

export interface Breakdown {
  items: BreakdownItem[];
  outro?: string;
}

export interface IntakeAction {
  type: "monthly_income" | "transaction" | "goal" | "recurring";
  name?: string;
  amount?: number;
  target?: number;
  current?: number;
  category?: string;
  frequency?: "monthly" | "weekly";
  date?: string; // transaction only, YYYY-MM-DD
  next_date?: string; // recurring only, YYYY-MM-DD
}
