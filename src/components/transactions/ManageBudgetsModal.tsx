import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { categoryIcon } from "@/lib/categories";
import { currencyConfig } from "@/lib/currency";
import * as api from "@/services/api";
import type { CategoryBudgetRow } from "@/hooks/useSpendingData";

interface ManageBudgetsModalProps {
  open: boolean;
  onClose: () => void;
  budgetRows: CategoryBudgetRow[];
}

export function ManageBudgetsModal({ open, onClose, budgetRows }: ManageBudgetsModalProps) {
  const { user } = useAuth();
  const { currency, refetch } = useAppData();
  const symbol = currencyConfig(currency).symbol;

  const initialDrafts = useMemo(() => {
    const drafts: Record<string, string> = {};
    budgetRows.forEach((row) => {
      drafts[row.category] = row.budget != null ? String(row.budget) : "";
    });
    return drafts;
  }, [budgetRows]);

  const [drafts, setDrafts] = useState<Record<string, string>>(initialDrafts);
  const [newCategory, setNewCategory] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (open && Object.keys(drafts).length === 0 && Object.keys(initialDrafts).length > 0) {
    setDrafts(initialDrafts);
  }

  async function handleSaveRow(category: string) {
    if (!user) return;
    const raw = drafts[category] ?? "";
    setSaving(true);
    setError("");
    const amt = parseFloat(raw);
    const result =
      raw.trim() === "" || isNaN(amt) || amt <= 0
        ? await api.deleteBudget(user.id, category)
        : await api.upsertBudget(user.id, category, amt);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await refetch();
  }

  async function handleAddNew() {
    if (!user) return;
    const amt = parseFloat(newAmount);
    if (!newCategory.trim() || !amt || amt <= 0) {
      setError("Enter a category and an amount greater than 0.");
      return;
    }
    setSaving(true);
    setError("");
    const result = await api.upsertBudget(user.id, newCategory.trim(), amt);
    setSaving(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    setNewCategory("");
    setNewAmount("");
    await refetch();
  }

  return (
    <Modal open={open} onClose={onClose} title="Manage Budgets">
      {error && <p className="text-negative text-sm mb-3">{error}</p>}

      {budgetRows.length === 0 ? (
        <p className="text-sm text-ink-muted mb-4">
          No spending categories yet this month, add a transaction first, or set a budget for a new category below.
        </p>
      ) : (
        <div className="mb-4 max-h-[40vh] overflow-y-auto">
          {budgetRows.map((row) => {
            const Icon = categoryIcon(row.category);
            return (
              <div key={row.category} className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-0">
                <Icon size={15} color={row.color} className="flex-shrink-0" />
                <span className="flex-1 text-sm text-ink truncate">{row.category}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-ink-muted text-sm">{symbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={drafts[row.category] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [row.category]: e.target.value }))}
                    onBlur={() => handleSaveRow(row.category)}
                    placeholder="No limit"
                    disabled={saving}
                    className="w-24 px-2.5 py-1.5 rounded-lg border border-border-strong bg-surface text-ink text-sm text-right outline-none placeholder:text-ink-muted focus:border-brand transition-colors"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="pt-3 border-t border-border">
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
          Add a budget for another category
        </label>
        <div className="flex items-center gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="e.g. Travel"
            className="flex-1 min-w-0 px-3.5 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none placeholder:text-ink-muted focus:border-brand transition-colors"
          />
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            placeholder="0.00"
            className="w-24 flex-shrink-0 px-3 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm text-right outline-none placeholder:text-ink-muted focus:border-brand transition-colors"
          />
        </div>
        <Button fullWidth onClick={handleAddNew} disabled={saving} className="mt-3">
          {saving ? "Saving..." : "Add Budget"}
        </Button>
      </div>

      <p className="text-xs text-ink-muted text-center mt-4">Clear an amount to remove that category's budget.</p>
    </Modal>
  );
}