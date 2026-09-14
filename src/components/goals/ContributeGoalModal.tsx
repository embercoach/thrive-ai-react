import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import * as api from "@/services/api";
import type { Goal, GoalAutoContributeFrequency } from "@/types";
import { advanceDate, todayLocalStr, formatLocalDate, parseLocalDate } from "@/utils/dates";
import { useT } from "@/hooks/useI18n";

interface ContributeGoalModalProps {
  goal: Goal | null;
  onClose: () => void;
}

interface ActiveAutoContribute {
  amount: number;
  frequency: GoalAutoContributeFrequency;
  nextDate: string;
}

const FREQUENCIES: GoalAutoContributeFrequency[] = ["weekly", "biweekly", "monthly"];

export function ContributeGoalModal({ goal, onClose }: ContributeGoalModalProps) {
  const t = useT();
  const { user } = useAuth();
  const { refetch } = useAppData();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // --- Auto-save schedule ---
  // Tracked in local state rather than read straight off the `goal` prop:
  // GoalsPage keeps `contributeGoal` as a snapshot taken when the modal was
  // opened, so refetch()ing useAppData's goals list doesn't itself update
  // this modal's own `goal` reference until it's closed and reopened.
  // Reset whenever a different goal is opened (keyed on id, not object
  // identity, since a parent refetch can hand back a new object for the
  // same goal without this modal actually being reopened).
  const [autoActive, setAutoActive] = useState<ActiveAutoContribute | null>(null);
  const [autoAmount, setAutoAmount] = useState("");
  const [autoFrequency, setAutoFrequency] = useState<GoalAutoContributeFrequency>("monthly");
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoStopping, setAutoStopping] = useState(false);
  const [autoError, setAutoError] = useState("");

  useEffect(() => {
    setAmount("");
    setError("");
    setAutoAmount("");
    setAutoError("");
    setAutoActive(
      goal?.auto_contribute_amount && goal?.auto_contribute_frequency && goal?.auto_contribute_next_date
        ? {
            amount: goal.auto_contribute_amount,
            frequency: goal.auto_contribute_frequency,
            nextDate: goal.auto_contribute_next_date,
          }
        : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal?.id]);

  async function handleSave() {
    if (!goal || !user) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError(t("goalsModals.contribute.errorInvalidAmount"));
      return;
    }
    setSaving(true);
    setError("");
    // contributeToGoal() adds `amt` atomically in the database (see its own
    // doc comment) rather than computing `current + amt` from this modal's
    // `goal` snapshot — so two contributions to the same goal racing from
    // two devices/tabs correctly stack instead of one silently clobbering
    // the other. Modal's `preventClose` and refetch()-before-onClose still
    // matter for the same-modal-instance case: they keep the UI honest
    // about a save in flight, even though the write itself no longer needs
    // them for correctness.
    const { error: dbError } = await api.contributeToGoal(goal.id, amt);
    if (dbError) {
      setSaving(false);
      setError(dbError.message);
      return;
    }
    setAmount("");
    await refetch();
    setSaving(false);
    onClose();
  }

  async function handleStartAutoContribute() {
    if (!goal || !user) return;
    const amt = parseFloat(autoAmount);
    if (!amt || amt <= 0) {
      setAutoError(t("goalsModals.autoContribute.errorInvalidAmount"));
      return;
    }
    setAutoSaving(true);
    setAutoError("");
    // The schedule's first contribution lands one full period from today,
    // not immediately — starting auto-save shouldn't feel like it just
    // took money out on the spot, the same expectation a recurring bill's
    // first due date sets.
    const nextDate = advanceDate(todayLocalStr(), autoFrequency);
    const { error: dbError } = await api.updateGoal(user.id, goal.id, {
      auto_contribute_amount: amt,
      auto_contribute_frequency: autoFrequency,
      auto_contribute_next_date: nextDate,
    });
    setAutoSaving(false);
    if (dbError) {
      setAutoError(t("goalsModals.autoContribute.error"));
      return;
    }
    setAutoActive({ amount: amt, frequency: autoFrequency, nextDate });
    setAutoAmount("");
    refetch();
  }

  async function handleStopAutoContribute() {
    if (!goal || !user) return;
    setAutoStopping(true);
    setAutoError("");
    const { error: dbError } = await api.updateGoal(user.id, goal.id, {
      auto_contribute_amount: null,
      auto_contribute_frequency: null,
      auto_contribute_next_date: null,
    });
    setAutoStopping(false);
    if (dbError) {
      setAutoError(t("goalsModals.autoContribute.error"));
      return;
    }
    setAutoActive(null);
    refetch();
  }

  function frequencyLabel(f: GoalAutoContributeFrequency): string {
    return t(
      f === "weekly"
        ? "goalsModals.autoContribute.frequencyWeekly"
        : f === "biweekly"
          ? "goalsModals.autoContribute.frequencyBiweekly"
          : "goalsModals.autoContribute.frequencyMonthly"
    );
  }

  return (
    <Modal open={!!goal} onClose={onClose} title={t("goalsModals.contribute.title")} preventClose={saving}>
      {error && <p className="text-negative text-sm mb-3">{error}</p>}
      <p className="text-sm text-ink-secondary mb-3">
        {t("goalsModals.contribute.addingSavingsTo", { name: goal?.name ?? "" })}
      </p>
      <Input
        label={t("goalsModals.contribute.amountLabel")}
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="100"
        autoFocus
      />
      <Button fullWidth onClick={handleSave} disabled={saving}>
        {saving ? t("goalsModals.contribute.saving") : t("goalsModals.contribute.submit")}
      </Button>

      <div className="mt-5 pt-4 border-t border-border">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-2">
          {t("goalsModals.autoContribute.sectionTitle")}
        </div>

        {autoError && <p className="text-negative text-sm mb-3">{autoError}</p>}

        {autoActive ? (
          <div>
            <p className="text-sm text-ink-secondary mb-3">
              {t("goalsModals.autoContribute.activeDescription", {
                amount: String(autoActive.amount),
                frequency: frequencyLabel(autoActive.frequency),
                date: formatLocalDate(parseLocalDate(autoActive.nextDate)),
              })}
            </p>
            <Button variant="outline" fullWidth onClick={handleStopAutoContribute} disabled={autoStopping}>
              {autoStopping ? t("goalsModals.autoContribute.stopping") : t("goalsModals.autoContribute.stopButton")}
            </Button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-ink-secondary mb-3">{t("goalsModals.autoContribute.offDescription")}</p>
            <Input
              label={t("goalsModals.autoContribute.amountLabel")}
              type="number"
              value={autoAmount}
              onChange={(e) => setAutoAmount(e.target.value)}
              placeholder="50"
            />
            <div className="mb-3">
              <div className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                {t("goalsModals.autoContribute.frequencyLabel")}
              </div>
              <div className="flex gap-1.5">
                {FREQUENCIES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setAutoFrequency(f)}
                    className={`flex-1 py-2 px-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                      autoFrequency === f
                        ? "bg-brand text-ink-on-brand border-brand"
                        : "bg-surface text-ink-secondary border-border-strong"
                    }`}
                  >
                    {frequencyLabel(f)}
                  </button>
                ))}
              </div>
            </div>
            <Button variant="outline" fullWidth onClick={handleStartAutoContribute} disabled={autoSaving}>
              {autoSaving ? t("goalsModals.autoContribute.starting") : t("goalsModals.autoContribute.startButton")}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
