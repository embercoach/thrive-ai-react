import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Transaction, Goal, Budget, RecurringItem, Profile } from "@/types";
import * as api from "@/services/api";

interface AppDataContextValue {
  profile: Profile | null;
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  recurring: RecurringItem[];
  loading: boolean;
  currency: string;
  monthlyIncome: number;
  isPro: boolean;
  refetch: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Recurring bills are materialized into real transactions before anything
    // else loads, so every screen sees today's occurrences immediately.
    await api.processRecurring(user.id, profile?.currency || "USD");
    const [profileData, txns, goalList, budgetList, recurringList] = await Promise.all([
      api.fetchProfile(user.id),
      api.fetchTransactions(user.id),
      api.fetchGoals(user.id),
      api.fetchBudgets(user.id),
      api.fetchRecurring(user.id),
    ]);
    setProfile(profileData);
    setTransactions(txns);
    setGoals(goalList);
    setBudgets(budgetList);
    setRecurring(recurringList);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const lastFetchedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (user && lastFetchedUserId.current !== user.id) {
      lastFetchedUserId.current = user.id;
      refetch();
    }
  }, [user, refetch]);

  const value: AppDataContextValue = {
    profile,
    transactions,
    goals,
    budgets,
    recurring,
    loading,
    currency: profile?.currency || "USD",
    monthlyIncome: profile?.monthly_income || 0,
    isPro: !!profile?.is_pro,
    refetch,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within AppDataProvider");
  return ctx;
}
