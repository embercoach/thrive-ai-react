import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import * as api from "@/services/api";

interface AddGoalModalProps {
  open: boolean;
  onClose: () => void;
  onNeedUpgrade: () => void;
}

const FREE_GOAL_LIMIT = 2;

export function AddGoalModal({ open, onClose, onNeedUpgrade }: AddGoalModalProps) {
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
      setError("Please fill in goal name and target amount.");
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
    <Modal open={open} onClose={onClose} title="Add Goal">
      {error && <p className="text-negative text-sm mb-3">{error}</p>}
      <Input label="Goal Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Emergency Fund" />
      <Input
        label="Target Amount"
        type="number"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="5000"
      />
      <Input
        label="Current Savings"
        type="number"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        placeholder="0"
      />
      <Input label="Target Date" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      <Button fullWidth onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Add Goal"}
      </Button>
      {!isPro && (
        <p className="text-xs text-ink-muted text-center mt-2">
          Free plan: {goals.length} of {FREE_GOAL_LIMIT} goals used
        </p>
      )}
    </Modal>
  );
}
