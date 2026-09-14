import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { Transaction, Goal, Budget, RecurringItem, Profile, ManualAsset } from "@/types";
import * as api from "@/services/api";

interface AppDataContextValue {
  profile: Profile | null;
  transactions: Transaction[];
  goals: Goal[];
  budgets: Budget[];
  recurring: RecurringItem[];
  manualAssets: ManualAsset[];
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
  const [manualAssets, setManualAssets] = useState<ManualAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // `refetch` is memoized on `user` alone (see the eslint-disable below) so
  // its identity stays stable across the profile updates it itself causes.
  // Reading `profile` directly in its body would otherwise close over
  // whatever `profile` was at the moment `user` last changed — null, on the
  // very first login — and never see a later value for the rest of the
  // session, silently falling back to "USD" for every recurring row that
  // doesn't set its own currency. A ref sidesteps that without giving
  // `refetch` a new identity on every profile change.
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Same reasoning as profileRef above, applied to the other four lists —
  // fetchTransactions/fetchGoals/fetchBudgets/fetchRecurring now throw on a
  // real Supabase error instead of silently resolving with `[]`, so a
  // transient failure on any one of them (a network blip during any
  // refetch — after adding a transaction, a goal, a budget, anything) can
  // be caught below and fall back to what's already on screen instead of
  // wiping it out.
  const transactionsRef = useRef<Transaction[]>([]);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);
  const goalsRef = useRef<Goal[]>([]);
  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);
  const budgetsRef = useRef<Budget[]>([]);
  useEffect(() => {
    budgetsRef.current = budgets;
  }, [budgets]);
  const recurringRef = useRef<RecurringItem[]>([]);
  useEffect(() => {
    recurringRef.current = recurring;
  }, [recurring]);
  const manualAssetsRef = useRef<ManualAsset[]>([]);
  useEffect(() => {
    manualAssetsRef.current = manualAssets;
  }, [manualAssets]);

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
    await api.processRecurring(user.id, profileRef.current?.currency || "USD");
    const [profileData, txns, goalList, budgetList, recurringList, manualAssetList] = await Promise.all([
      // A transient fetchProfile error must not reject this whole
      // Promise.all — that would also stall transactions/goals/budgets/
      // recurring on the same blip, and (via OnboardingGate reading a null
      // profile as "not onboarded") could even bounce an already-onboarded
      // user back into onboarding. Fall back to the last known profile and
      // let the next refetch try again.
      api.fetchProfile(user.id).catch((err) => {
        console.error("fetchProfile failed, keeping last known profile:", err);
        return profileRef.current;
      }),
      api.fetchTransactions(user.id).catch((err) => {
        console.error("fetchTransactions failed, keeping last known transactions:", err);
        return transactionsRef.current;
      }),
      api.fetchGoals(user.id).catch((err) => {
        console.error("fetchGoals failed, keeping last known goals:", err);
        return goalsRef.current;
      }),
      api.fetchBudgets(user.id).catch((err) => {
        console.error("fetchBudgets failed, keeping last known budgets:", err);
        return budgetsRef.current;
      }),
      api.fetchRecurring(user.id).catch((err) => {
        console.error("fetchRecurring failed, keeping last known recurring:", err);
        return recurringRef.current;
      }),
      api.fetchManualAssets(user.id).catch((err) => {
        console.error("fetchManualAssets failed, keeping last known manual assets:", err);
        return manualAssetsRef.current;
      }),
    ]);
    setProfile(profileData);
    setTransactions(txns);
    setGoals(goalList);
    setBudgets(budgetList);
    setRecurring(recurringList);
    setManualAssets(manualAssetList);
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
    manualAssets,
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
