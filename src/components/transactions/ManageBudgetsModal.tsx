import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useT } from "@/hooks/useI18n";
import { categoryIcon } from "@/lib/categories";
import { currencyConfig } from "@/lib/currency";
import * as api from "@/services/api";
import type { CategoryBudgetRow } from "@/hooks/useSpendingData";
import { normCategory } from "@/utils/dates";

interface ManageBudgetsModalProps {
  open: boolean;
  onClose: () => void;
  budgetRows: CategoryBudgetRow[];
  onNeedUpgrade: () => void;
}

const FREE_BUDGET_LIMIT = 2;

export function ManageBudgetsModal({ open, onClose, budgetRows, onNeedUpgrade }: ManageBudgetsModalProps) {
  const t = useT();
  const { user } = useAuth();
  const { currency, budgets, isPro, refetch } = useAppData();
  const symbol = currencyConfig(currency).symbol;
  const activeBudgetCount = budgets.length;

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

  // Keep the editable draft values in sync with the real budget data
  // whenever it changes (e.g. right after adding a new budget via
  // handleAddNew and refetching) — not just on the very first render.
  useEffect(() => {
    setDrafts(initialDrafts);
  }, [initialDrafts]);

  async function handleSaveRow(category: string) {
    if (!user) return;
    const raw = drafts[category] ?? "";
    const amt = parseFloat(raw);
    const clearing = raw.trim() === "" || isNaN(amt) || amt <= 0;
    // Resolve to the existing budget row's exact stored casing (if any)
    // before using it as the write key. `budgets` and `budgetRows` are both
    // ultimately built from the same source, but `category` here comes from
    // a `budgetRows` row, whose label can differ in case from what's
    // actually stored in `budgets` after the useSpendingData normalization
    // fix — comparing raw strings here would then never recognize a budget
    // that in fact already exists, wrongly triggering the free-tier upgrade
    // paywall, or writing a case-variant duplicate row via `upsertBudget`'s
    // exact-string onConflict match, or silently failing to delete via
    // `deleteBudget`'s exact-string match.
    const existing = budgets.find((b) => normCategory(b.category) === normCategory(category));
    const writeCategory = existing?.category ?? category;
    const alreadyBudgeted = !!existing;
    if (!clearing && !alreadyBudgeted && !isPro && activeBudgetCount >= FREE_BUDGET_LIMIT) {
      onClose();
      onNeedUpgrade();
      return;
    }
    setSaving(true);
    setError("");
    const result = clearing
      ? await api.deleteBudget(user.id, writeCategory)
      : await api.upsertBudget(user.id, writeCategory, amt);
    if (result.error) {
      setSaving(false);
      setError(result.error.message);
      return;
    }
    // `drafts` gets reset from `initialDrafts` (derived from `budgetRows`)
    // whenever this refetch resolves — the same lost-update shape as the
    // goal-contribution race fixed earlier this session. Inputs stay
    // disabled (via `saving`) for the whole save-and-refetch round trip,
    // not just the initial write, so there's no window where a keystroke
    // into a different category's field can land and then get silently
    // wiped out from under the user the moment this refetch comes back.
    await refetch();
    setSaving(false);
  }

  async function handleAddNew() {
    if (!user) return;
    const trimmedCategory = newCategory.trim();
    // Same case-insensitive resolution as handleSaveRow: typing a category
    // that already has a budget under different casing should update that
    // existing row (and not count against the free-tier cap), not create a
    // case-variant duplicate that silently consumes another slot.
    const existing = budgets.find((b) => normCategory(b.category) === normCategory(trimmedCategory));
    if (!existing && !isPro && activeBudgetCount >= FREE_BUDGET_LIMIT) {
      onClose();
      onNeedUpgrade();
      return;
    }
    const amt = parseFloat(newAmount);
    if (!trimmedCategory || !amt || amt <= 0) {
      setError(t("transactions.manageBudgets.enterCategoryAmount"));
      return;
    }
    setSaving(true);
    setError("");
    const result = await api.upsertBudget(user.id, existing?.category ?? trimmedCategory, amt);
    if (result.error) {
      setSaving(false);
      setError(result.error.message);
      return;
    }
    setNewCategory("");
    setNewAmount("");
    // Same reasoning as handleSaveRow above: this refetch also resets
    // `drafts`, so row inputs must stay disabled until it resolves too.
    await refetch();
    setSaving(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={t("transactions.manageBudgets.title")}>
      {error && <p className="text-negative text-sm mb-3">{error}</p>}

      {budgetRows.length === 0 ? (
        <p className="text-sm text-ink-muted mb-4">{t("transactions.manageBudgets.noCategoriesYet")}</p>
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
                    type="text"
                    inputMode="decimal"
                    value={drafts[row.category] ?? ""}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "" || /^\d*\.?\d*$/.test(next)) {
                        setDrafts((d) => ({ ...d, [row.category]: next }));
                      }
                    }}
                    onBlur={() => handleSaveRow(row.category)}
                    placeholder={t("transactions.manageBudgets.noLimitPlaceholder")}
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
          {t("transactions.manageBudgets.addBudgetLabel")}
        </label>
        <div className="flex items-center gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder={t("transactions.manageBudgets.categoryPlaceholder")}
            className="flex-1 min-w-0 px-3.5 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none placeholder:text-ink-muted focus:border-brand transition-colors"
          />
          <input
            type="text"
            inputMode="decimal"
            value={newAmount}
            onChange={(e) => {
              const next = e.target.value;
              if (next === "" || /^\d*\.?\d*$/.test(next)) {
                setNewAmount(next);
              }
            }}
            placeholder={t("transactions.shared.amountPlaceholder")}
            className="w-24 flex-shrink-0 px-3 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm text-right outline-none placeholder:text-ink-muted focus:border-brand transition-colors"
          />
        </div>
        <Button fullWidth onClick={handleAddNew} disabled={saving} className="mt-3">
          {saving ? t("transactions.manageBudgets.saving") : t("transactions.manageBudgets.addBudget")}
        </Button>
        {!isPro && (
          <p className="text-xs text-ink-muted text-center mt-2">
            {t("transactions.manageBudgets.freePlanUsage", {
              used: activeBudgetCount,
              limit: FREE_BUDGET_LIMIT,
            })}
          </p>
        )}
      </div>

      <p className="text-xs text-ink-muted text-center mt-4">{t("transactions.manageBudgets.clearToRemove")}</p>
    </Modal>
  );
}