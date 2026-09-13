import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useT } from "@/hooks/useI18n";
import { categoryIcon } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";
import * as api from "@/services/api";
import type { RecurringItem } from "@/types";
import { todayLocalStr } from "@/utils/dates";

interface ManageRecurringModalProps {
  open: boolean;
  onClose: () => void;
  onNeedUpgrade: () => void;
}

const FREE_RECURRING_LIMIT = 2;

export function ManageRecurringModal({ open, onClose, onNeedUpgrade }: ManageRecurringModalProps) {
  const t = useT();
  const { user } = useAuth();
  const { recurring, currency, isPro, refetch } = useAppData();
  const [showAdd, setShowAdd] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">("monthly");
  const [nextDate, setNextDate] = useState(todayLocalStr);
  const [saving, setSaving] = useState(false);

  async function handleToggleActive(item: RecurringItem) {
    if (!user) return;
    setBusyId(item.id);
    setError("");
    const { error: dbError } = await api.updateRecurring(user.id, item.id, { active: !item.active });
    setBusyId(null);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await refetch();
  }

  async function handleDelete(item: RecurringItem) {
    if (!user) return;
    setBusyId(item.id);
    setError("");
    const { error: dbError } = await api.deleteRecurring(user.id, item.id);
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
    setNextDate(todayLocalStr());
  }

  async function handleAdd() {
    if (!user) return;
    if (!isPro && recurring.length >= FREE_RECURRING_LIMIT) {
      onClose();
      onNeedUpgrade();
      return;
    }
    const amt = parseFloat(amount);
    if (!name.trim() || !amt) {
      setError(t("transactions.shared.fillNameAmount"));
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
    <Modal open={open} onClose={onClose} title={t("transactions.manageRecurring.title")}>
      {error && <p className="text-negative text-sm mb-3">{error}</p>}

      {sorted.length === 0 && !showAdd ? (
        <p className="text-sm text-ink-muted mb-4">{t("transactions.manageRecurring.noneYet")}</p>
      ) : (
        <div className="mb-4 max-h-[36vh] overflow-y-auto">
          {sorted.map((item) => {
            const Icon = categoryIcon(item.category);
            return (
              <div key={item.id} className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-0">
                <button
                  onClick={() => handleToggleActive(item)}
                  disabled={busyId === item.id}
                  aria-label={
                    item.active ? t("transactions.manageRecurring.pauseAria") : t("transactions.manageRecurring.resumeAria")
                  }
                  className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-colors cursor-pointer ${
                    item.active ? "bg-brand" : "bg-surface-sunken border border-border-strong"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      item.active ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                <Icon size={14} className="flex-shrink-0 text-ink-secondary" />
                <div className={`flex-1 min-w-0 ${item.active ? "" : "opacity-50"}`}>
                  <div className="text-sm font-semibold text-ink truncate">{item.name}</div>
                  <div className="text-[11px] text-ink-muted">
                    {t("transactions.manageRecurring.nextDateDisplay", {
                      frequency:
                        item.frequency === "monthly"
                          ? t("transactions.manageRecurring.monthly")
                          : t("transactions.manageRecurring.weekly"),
                      date: item.next_date,
                    })}
                  </div>
                </div>
                <span className={`text-sm font-bold flex-shrink-0 ${item.amount < 0  ? "text-ink" : "text-positive"}`}>
                  {item.amount < 0  ? "-" : "+"}
                  {formatMoney(item.amount, currency)}
                </span>
                <button
                  onClick={() => handleDelete(item)}
                  disabled={busyId === item.id}
                  aria-label={t("transactions.shared.delete")}
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
          <Input
            label={t("transactions.manageRecurring.nameLabel")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("transactions.manageRecurring.namePlaceholder")}
          />
          <Input
            label={t("transactions.shared.amountLabel")}
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("transactions.shared.amountPlaceholder")}
          />
          <div className="mb-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
              {t("transactions.shared.typeLabel")}
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "expense" | "income")}
              className="w-full px-3.5 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none"
            >
              <option value="expense">{t("transactions.shared.expense")}</option>
              <option value="income">{t("transactions.shared.income")}</option>
            </select>
          </div>
          <Input
            label={t("transactions.shared.categoryLabel")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t("transactions.manageRecurring.categoryPlaceholder")}
          />
          <div className="mb-3">
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
              {t("transactions.manageRecurring.frequencyLabel")}
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as "monthly" | "weekly")}
              className="w-full px-3.5 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none"
            >
              <option value="monthly">{t("transactions.manageRecurring.monthly")}</option>
              <option value="weekly">{t("transactions.manageRecurring.weekly")}</option>
            </select>
          </div>
          <Input
            label={t("transactions.manageRecurring.nextDateLabel")}
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
          />
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
              {t("transactions.manageRecurring.cancel")}
            </Button>
            <Button fullWidth onClick={handleAdd} disabled={saving}>
              {saving ? t("transactions.shared.saving") : t("transactions.manageRecurring.save")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <Button variant="outline" fullWidth onClick={() => setShowAdd(true)}>
            <Plus size={15} /> {t("transactions.manageRecurring.addRecurring")}
          </Button>
          {!isPro && (
            <p className="text-xs text-ink-muted text-center mt-2">
              {t("transactions.manageRecurring.freePlanUsage", {
                used: recurring.length,
                limit: FREE_RECURRING_LIMIT,
              })}
            </p>
          )}
        </>
      )}
    </Modal>
  );
}
