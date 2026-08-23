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
    // `loading` is intentionally NOT set here — it starts true and this is
    // the only place that ever sets it false, so it naturally means "no data
    // yet at all", not "a fetch is in flight". Setting it true on every call
    // used to make each refetch (after saving a transaction, a goal, etc.)
    // blank the whole screen back to the initial loading gate — jarring
    // mid-interaction, and the actual bug behind "loading skeletons": what
    // needed fixing wasn't a missing skeleton, it was this state being shown
    // far more often than it should have been. Screens now keep rendering
    // their current data uninterrupted while a refetch resolves in the
    // background, since the underlying values just update in place.
    //
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
