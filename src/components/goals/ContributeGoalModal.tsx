import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import * as api from "@/services/api";
import type { Goal } from "@/types";

interface ContributeGoalModalProps {
  goal: Goal | null;
  onClose: () => void;
}

export function ContributeGoalModal({ goal, onClose }: ContributeGoalModalProps) {
  const { user } = useAuth();
  const { refetch } = useAppData();
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!goal || !user) return;
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    setSaving(true);
    setError("");
    // `current + amt` is computed from the goal snapshot this modal was
    // opened with, not read fresh from the server. If the modal could be
    // closed and reopened for the same goal while this write is still in
    // flight, a second contribution would add to that same stale `current`
    // and silently overwrite the first one instead of stacking on top of
    // it — the app would show two successful confirmations but only bank
    // one contribution. The modal stays open (via Modal's `preventClose`)
    // and refetch() runs before onClose() so the goal data is guaranteed
    // fresh by the time the user can act on this goal again.
    const { error: dbError } = await api.updateGoal(user.id, goal.id, { current: goal.current + amt });
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
    <Modal open={!!goal} onClose={onClose} title="Add to Goal" preventClose={saving}>
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
