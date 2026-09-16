import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useT } from "@/hooks/useI18n";
import { useAvailableToSpend, useNetWorth } from "@/hooks/useHomeMetrics";
import { parseBreakdown } from "@/lib/parseBreakdown";
import { parseIntake } from "@/lib/parseIntake";
import { compressImageForUpload } from "@/lib/imageCompress";
import * as api from "@/services/api";
import { supabase } from "@/services/supabase";
import type { Breakdown, IntakeAction } from "@/types";
import { parseLocalDate, todayLocal, todayLocalStr, advanceDate, isSameMonth, normCategory } from "@/utils/dates";

export type IntakeStatus = "pending" | "confirming" | "confirmed" | "partial" | "dismissed";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  breakdown?: Breakdown | null;
  intake?: IntakeAction[] | null;
  intakeStatus?: IntakeStatus;
  intakeNote?: string;
  /** Client-only, session-local thumbnail for a receipt photo the user just
   *  sent (see sendReceipt below) — the photo itself is never persisted,
   *  only a text placeholder, so this is never set on a message restored
   *  from chat history. */
  imagePreviewUrl?: string;
  /** Message came back from history and had an intake block that can no
   *  longer be acted on (confirmation state is session-local). */
  intakeExpired?: boolean;
}

const FREE_MONTHLY_QUESTIONS = 3;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Last-line defense on any date the model proposed. Even told today's date,
 * a model can still emit a malformed or future-dated value, and a bad date
 * silently files the row under the wrong month — which then quietly skews
 * every "this month" total in the app. Anything not a real, non-future
 * calendar date falls back to today.
 */
function safeIntakeDate(proposed: string | undefined, todayStr: string): string {
  if (!proposed || !ISO_DATE_RE.test(proposed)) return todayStr;
  const parsed = parseLocalDate(proposed);
  if (Number.isNaN(parsed.getTime())) return todayStr;
  return proposed > todayStr ? todayStr : proposed;
}

const MAX_INTAKE_ACTIONS_PER_TURN = 20;
// Generous upper bound for any single personal transaction/recurring bill/
// goal/income figure a model should plausibly propose — not a real-world
// limit, just a backstop against an absurd hallucinated or injected value
// (e.g. text hidden in a photographed receipt) being offered as a one-tap
// "Add to my account" with nothing anywhere else in the pipeline checking
// its magnitude.
const MAX_SANE_AMOUNT = 10_000_000;
function isSaneAmount(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= MAX_SANE_AMOUNT;
}
const FREE_RECURRING_LIMIT = 2;
const FREE_GOAL_LIMIT = 2;

export function useChat() {
  const t = useT();
  const { user } = useAuth();
  const { profile, transactions, goals, budgets, recurring, manualAssets, currency, monthlyIncome, isPro, refetch } =
    useAppData();
  const availableToSpend = useAvailableToSpend(transactions, recurring);
  const netWorth = useNetWorth(transactions, manualAssets);

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api
      .fetchChatHistory(user.id)
      .then((history) => {
        setMessages(
          history.map((m, i) => {
            const { text: textAfterBreakdown, breakdown } = parseBreakdown(m.content);
            // Intake actions are deliberately NOT restored — confirmation
            // state is session-local, so a reloaded conversation must never
            // re-offer an already-answered card. But the tag still has to be
            // stripped here, or the raw JSON leaks into the visible bubble.
            const { text, hadIntake } = parseIntake(textAfterBreakdown);
            return { id: m.id ?? `hist-${i}`, role: m.role, text, breakdown, intakeExpired: hadIntake };
          })
        );
      })
      .catch(() => {
        // History failing to load shouldn't block the user from starting a
        // fresh conversation — worst case they lose sight of past messages
        // for this session, not the ability to use the Advisor at all.
        setMessages([]);
      })
      .finally(() => setLoadingHistory(false));
  }, [user]);

  // Deliberately local, not `new Date().toISOString().slice(0, 7)` — that
  // reads the UTC month, which rolls over up to ~12 hours off from the
  // user's own calendar and would let the free-tier question limit reset
  // early (or stay stuck) purely depending on timezone. See utils/dates.ts.
  const currentMonthKey = todayLocalStr().slice(0, 7); // "YYYY-MM", local
  const questionsUsedThisMonth =
    profile?.ai_questions_month === currentMonthKey ? profile?.ai_questions_count ?? 0 : 0;
  const limitReached = !isPro && questionsUsedThisMonth >= FREE_MONTHLY_QUESTIONS;

  const context = useMemo(() => {
    const today = todayLocal();
    // Grouped by normCategory (case-insensitive) rather than the raw string,
    // and matched against budgets the same way — same reasoning as
    // useSpendingData.ts/useHomeMetrics.ts: a Plaid-synced "groceries"
    // transaction and a manually-typed "Groceries" budget are the same
    // category to a user, and without this the AI advisor's own view of
    // spending would show that category as unbudgeted (or split into two
    // separate rows) even though the rest of the app correctly matches them.
    const byCat: Record<string, { label: string; amount: number }> = {};
    transactions
      .filter((t) => isSameMonth(parseLocalDate(t.date), today) && t.amount < 0)
      .forEach((t) => {
        const cat = t.category || "Other";
        const key = normCategory(cat);
        const entry = byCat[key] ?? { label: cat, amount: 0 };
        entry.amount += Math.abs(t.amount);
        byCat[key] = entry;
      });
    const spendingByCategory = Object.entries(byCat).map(([key, { label, amount }]) => ({
      category: label,
      amount,
      budget: budgets.find((b) => normCategory(b.category) === key)?.amount,
    }));

    return {
      // The model can't know the real date on its own, and the API route runs
      // in UTC — send the user's own local date so dated writes land right.
      today: todayLocalStr(),
      currency,
      monthlyIncome,
      netWorth,
      availableToSpend,
      spendingByCategory,
      goals: goals.map((g) => ({ name: g.name, current: g.current, target: g.target })),
      upcomingBills: recurring
        .filter((r) => r.active !== false)
        .slice(0, 8)
        .map((r) => ({ name: r.name, amount: r.amount, dueDate: r.next_date })),
      recentTransactions: transactions.slice(0, 15).map((t) => ({
        name: t.name,
        amount: t.amount,
        category: t.category,
        date: t.date,
      })),
    };
  }, [transactions, goals, budgets, recurring, currency, monthlyIncome, netWorth, availableToSpend]);

  const send = useCallback(
    async (userText: string) => {
      if (!user || !userText.trim() || sending) return;
      if (limitReached) {
        setError(t("advisor.limitReachedError", { limit: FREE_MONTHLY_QUESTIONS }));
        return;
      }
      setError("");
      setSending(true);

      const userMsg: DisplayMessage = { id: `u-${Date.now()}`, role: "user", text: userText.trim() };
      setMessages((prev) => [...prev, userMsg]);
      // Persisting the user's own message is best-effort and must never
      // block or fail the actual send — but sitting outside any try/catch
      // meant a rejection here (a dropped connection, not just a resolved
      // {error}) threw before the try block below was ever entered, so the
      // `finally { setSending(false) }` in that block never ran: the
      // composer stayed permanently disabled with no error shown, fixable
      // only by a full page reload.
      try {
        const { error: saveErr } = await api.saveChatMessage(user.id, "user", userText.trim());
        if (saveErr) console.error("Failed to persist user chat message:", saveErr);
      } catch (err) {
        console.error("Failed to persist user chat message:", err);
      }

      try {
        // The API route now requires a valid Supabase session (it's a
        // publicly reachable URL that spends the app's own paid Anthropic
        // API budget per call, so it can no longer be called unauthenticated
        // — see api/chat.ts). getSession() reads the current, auto-refreshed
        // token rather than caching one from an earlier render.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError(t("common.sessionExpired"));
          return;
        }

        const history = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.text,
        }));
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ messages: history, context }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) throw new Error(t("common.sessionExpired"));
          if (res.status === 402) {
            // The server's own count is the source of truth and may have
            // moved since this tab last loaded it (e.g. the limit was hit
            // in another tab) — refresh so "X of 3 left" reflects reality
            // rather than staying stuck on a stale, too-generous number.
            await refetch();
          }
          throw new Error(data.error || t("common.somethingWentWrong"));
        }

        const { text: textAfterBreakdown, breakdown } = parseBreakdown(data.text as string);
        const { text, intake } = parseIntake(textAfterBreakdown);

        let actions = intake?.actions ?? null;
        let intakeNote: string | undefined;
        if (actions && actions.length > MAX_INTAKE_ACTIONS_PER_TURN) {
          actions = actions.slice(0, MAX_INTAKE_ACTIONS_PER_TURN);
          intakeNote = t("advisor.intakeNoteMore", { max: MAX_INTAKE_ACTIONS_PER_TURN });
        }

        const assistantMsg: DisplayMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text,
          breakdown,
          intake: actions,
          intakeStatus: actions ? "pending" : undefined,
          intakeNote,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        const { error: saveAssistantErr } = await api.saveChatMessage(user.id, "assistant", data.text as string);
        if (saveAssistantErr) console.error("Failed to persist assistant chat message:", saveAssistantErr);

        // The free-question counter is now reserved atomically server-side
        // (see api/chat.ts's use_ai_question call) before this response
        // ever came back — a database trigger blocks any client write to
        // ai_questions_count/ai_questions_month directly (see the
        // lock_down_privileged_profile_columns migration), the same way it
        // blocks a client from setting is_pro. Refetching just pulls the
        // now-authoritative count back into this tab's local state.
        if (!isPro) await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.somethingWentWrongRetry"));
      } finally {
        setSending(false);
      }
    },
    [user, sending, limitReached, messages, context, isPro, refetch, t]
  );

  // Scans a receipt photo via /api/scan-receipt and offers the result
  // through the exact same IntakePreviewCard/confirmIntake flow a normal
  // chat message's proposed transaction goes through below — this is
  // deliberately NOT a separate save path, just a different way of
  // proposing the same kind of THRIVE_INTAKE block. It spends from the
  // same free-question quota as send() (api/scan-receipt.ts reserves
  // against the identical use_ai_question pool), not a separate counter.
  const sendReceipt = useCallback(
    async (file: File) => {
      if (!user || sending) return;
      if (limitReached) {
        setError(t("advisor.limitReachedError", { limit: FREE_MONTHLY_QUESTIONS }));
        return;
      }
      setError("");
      setSending(true);

      let compressed;
      try {
        compressed = await compressImageForUpload(file);
      } catch {
        setError(t("advisor.receiptReadError"));
        setSending(false);
        return;
      }

      // The photo itself is never persisted — chat_messages only ever
      // stores text, same as every other message. A reloaded conversation
      // shows this placeholder in its place; the actual thumbnail below is
      // client-side and session-local only, gone on refresh.
      const placeholderText = t("advisor.receiptMessagePlaceholder");
      const userMsg: DisplayMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        text: placeholderText,
        imagePreviewUrl: compressed.dataUrl,
      };
      setMessages((prev) => [...prev, userMsg]);
      // Same reasoning as send() above — must not throw out to the outer
      // scope and skip the try/finally below, or `sending` gets stuck true
      // forever with no way to recover short of a page reload.
      try {
        const { error: saveErr } = await api.saveChatMessage(user.id, "user", placeholderText);
        if (saveErr) console.error("Failed to persist user chat message:", saveErr);
      } catch (err) {
        console.error("Failed to persist user chat message:", err);
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError(t("common.sessionExpired"));
          return;
        }

        const res = await fetch("/api/scan-receipt", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ image: compressed.base64, mediaType: compressed.mediaType, today: todayLocalStr() }),
        });
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 401) throw new Error(t("common.sessionExpired"));
          if (res.status === 402) await refetch();
          throw new Error(data.error || t("common.somethingWentWrongRetry"));
        }

        const { text: textAfterBreakdown, breakdown } = parseBreakdown(data.text as string);
        const { text, intake } = parseIntake(textAfterBreakdown);

        // Same cap send() applies below to a chat-derived intake block —
        // api/scan-receipt.ts's prompt asks for exactly one transaction, but
        // nothing enforces that shape server- or client-side, and
        // confirmIntake() (which actually writes to Supabase) has no cap of
        // its own. Applying it here too means a single tap of "Add to my
        // account" can never turn into an unbounded batch of writes,
        // whatever a vision model's response ends up containing.
        let actions = intake?.actions ?? null;
        let intakeNote: string | undefined;
        if (actions && actions.length > MAX_INTAKE_ACTIONS_PER_TURN) {
          actions = actions.slice(0, MAX_INTAKE_ACTIONS_PER_TURN);
          intakeNote = t("advisor.intakeNoteMore", { max: MAX_INTAKE_ACTIONS_PER_TURN });
        }

        const assistantMsg: DisplayMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          text,
          breakdown,
          intake: actions,
          intakeStatus: actions ? "pending" : undefined,
          intakeNote,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        const { error: saveAssistantErr } = await api.saveChatMessage(user.id, "assistant", data.text as string);
        if (saveAssistantErr) console.error("Failed to persist assistant chat message:", saveAssistantErr);

        // Same reasoning as send() — the count is reserved server-side
        // before the response ever came back; this just pulls the
        // now-authoritative count into this tab's local state.
        if (!isPro) await refetch();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.somethingWentWrongRetry"));
      } finally {
        setSending(false);
      }
    },
    [user, sending, limitReached, isPro, refetch, t]
  );

  const clear = useCallback(async () => {
    if (!user) return { error: null };
    // Only wipe local state once the delete actually lands. Previously this
    // ignored the response's `error` entirely and always cleared local
    // state, so a failed delete (network blip, RLS issue) showed an empty
    // conversation while the messages were still in Supabase — a reload
    // later brought the "cleared" history back, reading as confusing
    // un-deletion on top of the original data loss.
    const { error } = await api.clearChatHistory(user.id);
    if (error) return { error: error.message };
    setMessages([]);
    return { error: null };
  }, [user]);

  // Best-effort: a thumbs up/down is a nice-to-have quality signal, not
  // something that should ever interrupt or error out the conversation the
  // user is actually having. Silently drops on failure (network blip, RLS)
  // rather than surfacing an error for what's essentially a passive rating.
  const rateMessage = useCallback(
    (messageText: string, rating: "up" | "down") => {
      if (!user) return;
      api.submitChatFeedback(user.id, messageText, rating).catch(() => {});
    },
    [user]
  );

  // Confirms a proposed THRIVE_INTAKE batch by actually writing it to
  // Supabase, via the exact same client-side api.* calls (and the same
  // RLS-protected anon Supabase client) the Add modals already use — nothing
  // is saved until the user taps confirm here. Sequential, not Promise.all,
  // so the running recurring/goal counters below correctly gate the
  // free-plan caps item-by-item within one batch instead of every write
  // reading the same stale count.
  const confirmIntake = useCallback(
    async (messageId: string, onNeedUpgrade: (reason: string) => void) => {
      const msg = messages.find((m) => m.id === messageId);
      if (!user || !msg?.intake || msg.intakeStatus === "confirming" || msg.intakeStatus === "confirmed") return;

      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, intakeStatus: "confirming" } : m)));

      const todayStr = todayLocalStr();
      let recurringCount = recurring.length;
      let goalCount = goals.length;
      let savedCount = 0;
      let upgradeBlockedCount = 0;
      let failedCount = 0;
      let hitRecurringCap = false;
      let hitGoalCap = false;

      for (const action of msg.intake) {
        try {
          switch (action.type) {
            case "transaction": {
              if (!action.name || !isSaneAmount(action.amount)) {
                failedCount++;
                continue;
              }
              const { error } = await api.addTransaction({
                user_id: user.id,
                // Trimmed like `category` on the next line — a model-
                // proposed name is never typed through an HTML <input>
                // (which strips this on its own), so it can otherwise carry
                // leading/trailing whitespace, or a bare \r that would
                // silently split this row's CSV export line (see
                // src/lib/csv.ts's csvField).
                name: action.name.trim(),
                amount: action.amount,
                category: action.category?.trim() || "Other",
                date: safeIntakeDate(action.date, todayStr),
                currency,
              });
              if (error) failedCount++;
              else savedCount++;
              break;
            }
            case "recurring": {
              if (!action.name || !isSaneAmount(action.amount)) {
                failedCount++;
                continue;
              }
              if (!isPro && recurringCount >= FREE_RECURRING_LIMIT) {
                upgradeBlockedCount++;
                hitRecurringCap = true;
                continue;
              }
              const { error } = await api.addRecurring({
                user_id: user.id,
                name: action.name.trim(),
                amount: action.amount,
                category: action.category?.trim() || "Other",
                currency,
                frequency: action.frequency || "monthly",
                // A recurring rule whose next_date is today gets posted as a
                // real transaction immediately by processRecurring — so
                // defaulting to today would make "my rent is $700/month"
                // instantly charge $700 of spending the user never made.
                // Default to the next cycle instead; only an explicit date
                // from the user is honoured as-is.
                next_date:
                  action.next_date && ISO_DATE_RE.test(action.next_date)
                    ? action.next_date
                    : advanceDate(todayStr, action.frequency || "monthly"),
                active: true,
              });
              if (error) {
                failedCount++;
              } else {
                savedCount++;
                recurringCount++;
              }
              break;
            }
            case "goal": {
              // A target of exactly 0 passed the old `typeof === "number"`
              // check and got saved as-is — every progress ring/bar reading
              // current/target (GoalCard, Home, the featured-goal card) then
              // divides by that zero, rendering a broken "NaN%" with no
              // error anywhere. A chat-proposed goal is the only creation
              // path that could reach this: AddGoalModal and OnboardingPage
              // both already require a positive amount client-side.
              if (!action.name || !isSaneAmount(action.target) || action.target === 0) {
                failedCount++;
                continue;
              }
              if (!isPro && goalCount >= FREE_GOAL_LIMIT) {
                upgradeBlockedCount++;
                hitGoalCap = true;
                continue;
              }
              const { error } = await api.addGoal({
                user_id: user.id,
                name: action.name.trim(),
                target: Math.abs(action.target),
                current: Math.abs(action.current || 0),
                deadline: null,
              });
              if (error) {
                failedCount++;
              } else {
                savedCount++;
                goalCount++;
              }
              break;
            }
            case "monthly_income": {
              if (!isSaneAmount(action.amount)) {
                failedCount++;
                continue;
              }
              const { error } = await api.upsertProfile({ id: user.id, monthly_income: Math.abs(action.amount) });
              if (error) failedCount++;
              else savedCount++;
              break;
            }
          }
        } catch {
          failedCount++;
        }
      }

      await refetch();

      const noteParts: string[] = [];
      if (upgradeBlockedCount > 0) {
        noteParts.push(
          t(upgradeBlockedCount > 1 ? "advisor.intakeNeedsProMany" : "advisor.intakeNeedsProOne", { count: upgradeBlockedCount })
        );
      }
      if (failedCount > 0) noteParts.push(t("advisor.intakeFailed", { count: failedCount }));
      const note = noteParts.length
        ? t("advisor.intakeSavedWithNotes", { count: savedCount, notes: noteParts.join(", ") })
        : t(savedCount === 1 ? "advisor.intakeAddedOne" : "advisor.intakeAddedMany", { count: savedCount });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, intakeStatus: upgradeBlockedCount > 0 || failedCount > 0 ? "partial" : "confirmed", intakeNote: note }
            : m
        )
      );

      if (hitRecurringCap) onNeedUpgrade("recurringTransactions");
      else if (hitGoalCap) onNeedUpgrade("goals");
    },
    [user, messages, recurring.length, goals.length, isPro, currency, refetch]
  );

  const dismissIntake = useCallback((messageId: string) => {
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, intakeStatus: "dismissed" } : m)));
  }, []);

  return {
    messages,
    loadingHistory,
    sending,
    error,
    send,
    sendReceipt,
    clear,
    rateMessage,
    confirmIntake,
    dismissIntake,
    questionsUsedThisMonth,
    limitReached,
    freeLimit: FREE_MONTHLY_QUESTIONS,
    isPro,
    profileName: profile?.name,
  };
}
