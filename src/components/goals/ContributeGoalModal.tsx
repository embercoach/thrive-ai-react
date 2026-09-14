import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import * as api from "@/services/api";
import type { Goal } from "@/types";
import { useT } from "@/hooks/useI18n";

interface ContributeGoalModalProps {
  goal: Goal | null;
  onClose: () => void;
}

export function ContributeGoalModal({ goal, onClose }: ContributeGoalModalProps) {
  const t = useT();
  const { user } = useAuth();
  const { refetch } = useAppData();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    </Modal>
  );
}
