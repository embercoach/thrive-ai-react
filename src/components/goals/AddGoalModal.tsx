import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import * as api from "@/services/api";
import { useT } from "@/hooks/useI18n";

interface AddGoalModalProps {
  open: boolean;
  onClose: () => void;
  onNeedUpgrade: () => void;
}

const FREE_GOAL_LIMIT = 2;

export function AddGoalModal({ open, onClose, onNeedUpgrade }: AddGoalModalProps) {
  const t = useT();
  const { user } = useAuth();
  const { goals, isPro, refetch } = useAppData();
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!user) return;
    const targetAmt = Math.abs(parseFloat(target));
    if (!name.trim() || !targetAmt) {
      setError(t("goalsModals.addGoal.errorRequired"));
      return;
    }
    if (!isPro && goals.length >= FREE_GOAL_LIMIT) {
      onClose();
      onNeedUpgrade();
      return;
    }
    setSaving(true);
    setError("");
    const { error: dbError } = await api.addGoal({
      user_id: user.id,
      name: name.trim(),
      target: targetAmt,
      current: Math.abs(parseFloat(current)) || 0,
      deadline: deadline || null,
    });
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setName("");
    setTarget("");
    setCurrent("");
    setDeadline("");
    onClose();
    await refetch();
  }

  return (
    <Modal open={open} onClose={onClose} title={t("goalsModals.addGoal.title")}>
      {error && <p className="text-negative text-sm mb-3">{error}</p>}
      <Input
        label={t("goalsModals.addGoal.nameLabel")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("goalsModals.addGoal.namePlaceholder")}
      />
      <Input
        label={t("goalsModals.addGoal.targetLabel")}
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="5000"
      />
      <Input
        label={t("goalsModals.addGoal.currentLabel")}
        type="number"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder="0"
      />
      <Input
        label={t("goalsModals.addGoal.dateLabel")}
        type="date"
        value={deadline}
        onChange={(e) => setDeadline(e.target.value)}
      />
      <Button fullWidth onClick={handleSave} disabled={saving}>
        {saving ? t("goalsModals.addGoal.saving") : t("goalsModals.addGoal.submit")}
      </Button>
      {!isPro && (
        <p className="text-xs text-ink-muted text-center mt-2">
          {t("goalsModals.addGoal.freePlanUsage", { current: goals.length, limit: FREE_GOAL_LIMIT })}
        </p>
      )}
    </Modal>
  );
}
