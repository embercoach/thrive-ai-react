import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { categoryIcon } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";
import * as api from "@/services/api";
import type { RecurringItem } from "@/types";

interface ManageRecurringModalProps {
  open: boolean;
  onClose: () => void;
}

export function ManageRecurringModal({ open, onClose }: ManageRecurringModalProps) {
  const { user } = useAuth();
  const { recurring, currency, refetch } = useAppData();
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [nextDate, setNextDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  async function handleToggleActive(item: RecurringItem) {
    setBusyId(item.id);
    setError("");
    const { error: dbError } = await api.updateRecurring(item.id, { active: !item.active });
    setBusyId(null);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await refetch();
  }

  async function handleDelete(item: RecurringItem) {
    setBusyId(item.id);
    setError("");
    const { error: dbError } = await api.deleteRecurring(item.id);
    setBusyId(null);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await refetch();
  }

  function resetAddForm() {
    setName("");
    setAmount("");
    setType("expense");
    setCategory("");
    setFrequency("monthly");
    setNextDate(new Date().toISOString().split("T")[0]);
  }

  async function handleAdd() {
    if (!user) return;
    const amt = parseFloat(amount);
    if (!name.trim() || !amt) {
      setError("Please fill in name and amount.");
      return;
    }
    setSaving(true);
    setError("");
    const finalAmount = type === "expense" ? -Math.abs(amt) : Math.abs(amt);
    const { error: dbError } = await api.addRecurring({
      user_id: user.id,
      name: name.trim(),
      amount: finalAmount,
      category: category.trim() || "Other",
      currency,
      frequency,
      next_date: nextDate,
      active: true,
    });
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    resetAddForm();
    setShowAdd(false);
    await refetch();
  }

  const sorted = [...recurring].sort((a, b) => a.next_date.localeCompare(b.next_date));

  return (
    <Modal open={open} onClose={onClose} title="Manage Recurring">
      {error && <p className="text-negative text-sm mb-3">{error}</p>}

      {sorted.length === 0 && !showAdd ? (
        <p className="text-sm text-ink-muted mb-4">No recurring bills or income set up yet.</p>
      ) : (
        <div className="mb-4 max-h-[36vh] overflow-y-auto">
          {sorted.map((item) => {
            const Icon = categoryIcon(item.category);
            return (
              <div key={item.id} className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-0">
                <button
                  onClick={() => handleToggleActive(item)}
                  disabled={busyId === item.id}
                  aria-label={item.active ? "Pause" : "Resume"}
                  className={`w-8 h-4.5 rounded-full flex-shrink-0 relative transition-colors cursor-pointer ${
                    item.active ? "bg-brand" : "bg-surface-sunken border border-border-strong"
                  }`}
                  style={{ height: 18 }}
                >
                  <span
                    className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${
                      item.active ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <Icon size={14} className="flex-shrink-0 text-ink-secondary" />
                <div className={`flex-1 min-w-0 ${item.active ? "" : "opacity-50"}`}>
                  <div className="text-sm font-semibold text-ink truncate">{item.name}</div>
                  <div className="text-[11px] text-ink-muted">
                    {item.frequency === "monthly" ? "Monthly" : "Weekly"} · next {item.next_date}
                  </div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${item.amount < 0 ? "text-ink" : "text-positive"}`}>
                  {item.amount < 0 ? "-" : "+"}
                  {formatMoney(item.amount, currency)}
                </span>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={busyId === item.id}
                  aria-label="Delete"
                  className="text-ink-muted hover:text-negative cursor-pointer flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {showAdd ? (
        <div className="pt-3 border-t border-border">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rent" />
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
            placeholder="e.g. Housing"
          />
          <div className="mb-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as "monthly" | "weekly")}
              className="w-full px-3.5 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <Input label="Next Date" type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          <div className="flex gap-2">
            <Button
              variant="outline"
              fullWidth
              onClick={() => {
                setShowAdd(false);
                setError("");
                resetAddForm();
              }}
            >
              Cancel
            </Button>
            <Button fullWidth onClick={handleAdd} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" fullWidth onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Add Recurring
        </Button>
      )}
    </Modal>
  );
}