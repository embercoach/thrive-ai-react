import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppData } from "@/hooks/useAppData";
import * as api from "@/services/api";
import type { Goal } from "@/types";

interface ContributeGoalModalProps {
  goal: Goal | null;
  onClose: () => void;
}

export function ContributeGoalModal({ goal, onClose }: ContributeGoalModalProps) {
  const { refetch } = useAppData();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!goal) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setSaving(true);
    setError("");
    const { error: dbError } = await api.updateGoal(goal.id, { current: goal.current + amt });
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setAmount("");
    onClose();
    await refetch();
  }

  return (
    <Modal open={!!goal} onClose={onClose} title="Add to Goal">
      {error && <p className="text-negative text-sm mb-3">{error}</p>}
      <p className="text-sm text-ink-secondary mb-3">Adding savings to: {goal?.name}</p>
      <Input
        label="Amount to Add"
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="100"
        autoFocus
      />
      <Button fullWidth onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Add Savings"}
      </Button>
    </Modal>
  );
}
