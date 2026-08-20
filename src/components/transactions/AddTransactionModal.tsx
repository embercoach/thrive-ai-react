import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import * as api from "@/services/api";
import { todayLocalStr } from "@/utils/dates";

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ open, onClose }: AddTransactionModalProps) {
  const { user } = useAuth();
  const { currency, refetch } = useAppData();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(todayLocalStr);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!user) return;
    const amt = parseFloat(amount);
    if (!name.trim() || !amt) {
      setError("Please fill in name and amount.");
      return;
    }
    setSaving(true);
    setError("");
    const finalAmount = type === "expense" ? -Math.abs(amt) : Math.abs(amt);
    const { error: dbError } = await api.addTransaction({
      user_id: user.id,
      name: name.trim(),
      amount: finalAmount,
      category: category.trim() || "Other",
      date,
      currency,
    });
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setName("");
    setAmount("");
    setCategory("");
    onClose();
    await refetch();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction">
      {error && <p className="text-negative text-sm mb-3">{error}</p>}
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grocery Shopping" />
      <Input
        label="Amount"
        type="number"
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
      />
      <div className="mb-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "expense" | "income")}
          className="w-full px-3.5 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <Input
        label="Category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="e.g. Food, Housing, Transport…"
      />
      <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Button fullWidth onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Add Transaction"}
      </Button>
    </Modal>
  );
}
