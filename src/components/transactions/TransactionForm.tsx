import { useState } from "react";
import { Plus, X, SplitSquareHorizontal } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/currency";
import { useT } from "@/hooks/useI18n";
import type { Transaction } from "@/types";
import { todayLocalStr } from "@/utils/dates";

export interface SplitLeg {
  category: string;
  amount: string; // kept as the raw input string until submit
}

export interface TransactionFormValues {
  name: string;
  amount: number; // signed: negative = expense, positive = income
  category: string;
  date: string; // YYYY-MM-DD
  account: string | null;
  notes: string | null;
  /** Present only when the user split the purchase. Each leg is already
   *  signed the same way as `amount`. */
  splits?: { category: string; amount: number }[];
}

interface TransactionFormProps {
  /** Existing row when editing; omit when adding. */
  initial?: Transaction;
  submitLabel: string;
  saving: boolean;
  error?: string;
  currency?: string;
  /** Splitting only makes sense when creating — a leg is edited on its own. */
  allowSplit?: boolean;
  onSubmit: (values: TransactionFormValues) => void;
  /** Rendered next to the submit button — used by Edit to host Delete. */
  secondaryAction?: React.ReactNode;
}

/**
 * The add and edit sheets need byte-identical fields, validation and sign
 * handling — if they drift, an edit silently reinterprets a row differently
 * from how it was created. Keeping one form means there is exactly one place
 * where "expense" becomes a negative number.
 */
export function TransactionForm({
  initial,
  submitLabel,
  saving,
  error,
  currency = "USD",
  allowSplit = false,
  onSubmit,
  secondaryAction,
}: TransactionFormProps) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount)) : "");
  const [type, setType] = useState<"expense" | "income">(
    initial && initial.amount > 0 ? "income" : "expense"
  );
  const [category, setCategory] = useState(initial?.category ?? "");
  const [date, setDate] = useState(initial?.date ?? todayLocalStr());
  const [account, setAccount] = useState(initial?.account ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [localError, setLocalError] = useState("");

  const [splitting, setSplitting] = useState(false);
  const [legs, setLegs] = useState<SplitLeg[]>([
    { category: "", amount: "" },
    { category: "", amount: "" },
  ]);

  const total = parseFloat(amount) || 0;
  // Math.abs on each leg here matters, not just style: submission (below)
  // persists every leg as `sign * Math.abs(parseFloat(l.amount))`, so a
  // negative-typed leg (e.g. "-5") is silently stored as if the user had
  // typed "5". Summing raw signed values here let a negative leg cancel
  // part of the total and show "Balanced" for a split whose actual stored
  // total (all legs sharing the same sign) would come out higher than the
  // amount the user saw and confirmed — this keeps the live check honest
  // by matching exactly what will be persisted.
  const allocated = legs.reduce((sum, l) => sum + Math.abs(parseFloat(l.amount) || 0), 0);
  const remaining = Math.round((total - allocated) * 100) / 100;

  function updateLeg(i: number, patch: Partial<SplitLeg>) {
    setLegs((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLeg() {
    setLegs((prev) => [...prev, { category: "", amount: "" }]);
  }
  function removeLeg(i: number) {
    setLegs((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt) {
      setLocalError(t("transactions.shared.fillNameAmount"));
      return;
    }

    const sign = type === "expense" ? -1 : 1;
    const base = {
      name: name.trim(),
      amount: sign * Math.abs(amt),
      date,
      account: account.trim() || null,
      notes: notes.trim() || null,
    };

    if (splitting) {
      // A negative or zero amount has no sane meaning for a split leg (all
      // legs share the transaction's one Type/sign), and letting one
      // through here — rather than just excluding it below — would let a
      // user "balance" the total by typing a negative number that then
      // gets flattened to positive on persist, silently recording more
      // spend than what they saw as "Balanced".
      const hasInvalidLeg = legs.some((l) => l.category.trim() && parseFloat(l.amount) <= 0);
      if (hasInvalidLeg) {
        setLocalError(t("transactions.form.eachSplitPositive"));
        return;
      }
      const filled = legs.filter((l) => l.category.trim() && parseFloat(l.amount) > 0);
      if (filled.length < 2) {
        setLocalError(t("transactions.form.splitNeedsTwo"));
        return;
      }
      if (Math.abs(remaining) > 0.009) {
        setLocalError(
          remaining > 0
            ? t("transactions.form.unallocated", { amount: formatMoney(remaining, currency) })
            : t("transactions.form.splitOverBy", { amount: formatMoney(Math.abs(remaining), currency) })
        );
        return;
      }
      setLocalError("");
      onSubmit({
        ...base,
        // The parent row's category is the biggest leg, so a collapsed view
        // still shows something meaningful rather than "Other".
        category:
          [...filled].sort((a, b) => (parseFloat(b.amount) || 0) - (parseFloat(a.amount) || 0))[0]
            .category.trim() || "Other",
        splits: filled.map((l) => ({
          category: l.category.trim() || "Other",
          amount: sign * Math.abs(parseFloat(l.amount)),
        })),
      });
      return;
    }

    setLocalError("");
    onSubmit({ ...base, category: category.trim() || "Other" });
  }

  const shownError = error || localError;

  return (
    <>
      {shownError && <p className="text-negative text-sm mb-3">{shownError}</p>}

      <Input
        label={t("transactions.form.merchantLabel")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("transactions.form.merchantPlaceholder")}
      />
      <Input
        label={splitting ? t("transactions.form.totalAmountLabel") : t("transactions.shared.amountLabel")}
        type="number"
        step="0.01"
        inputMode="decimal"
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

      {splitting ? (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary">
              {t("transactions.form.splitAcrossLabel")}
            </label>
            <button
              type="button"
              onClick={() => setSplitting(false)}
              className="text-xs font-semibold text-ink-muted hover:text-ink transition-colors"
            >
              {t("transactions.form.cancelSplit")}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {legs.map((leg, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  value={leg.category}
                  onChange={(e) => updateLeg(i, { category: e.target.value })}
                  placeholder={t("transactions.shared.categoryLabel")}
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none placeholder:text-ink-muted focus:border-brand transition-colors"
                />
                <input
                  value={leg.amount}
                  onChange={(e) => updateLeg(i, { amount: e.target.value })}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder={t("transactions.shared.amountPlaceholder")}
                  className="w-[104px] flex-shrink-0 px-3 py-2.5 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none placeholder:text-ink-muted focus:border-brand transition-colors tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => removeLeg(i)}
                  disabled={legs.length <= 2}
                  aria-label={t("transactions.form.removeSplitLineAria")}
                  className="text-ink-muted hover:text-negative disabled:opacity-30 disabled:hover:text-ink-muted transition-colors flex-shrink-0"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-2.5">
            <button
              type="button"
              onClick={addLeg}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:opacity-80 transition-opacity"
            >
              <Plus size={13} /> {t("transactions.form.addCategory")}
            </button>
            <span
              className={`text-xs font-semibold tabular-nums ${
                Math.abs(remaining) < 0.01 ? "text-positive" : "text-ink-secondary"
              }`}
            >
              {Math.abs(remaining) < 0.01
                ? t("transactions.form.balanced")
                : remaining > 0
                  ? t("transactions.form.amountLeft", { amount: formatMoney(remaining, currency) })
                  : t("transactions.form.amountOver", { amount: formatMoney(Math.abs(remaining), currency) })}
            </span>
          </div>
        </div>
      ) : (
        <>
          <Input
            label={t("transactions.shared.categoryLabel")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder={t("transactions.form.categoryPlaceholder")}
          />
          {allowSplit && (
            <button
              type="button"
              onClick={() => setSplitting(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:opacity-80 transition-opacity -mt-1 mb-3"
            >
              <SplitSquareHorizontal size={14} /> {t("transactions.form.splitAcrossCategories")}
            </button>
          )}
        </>
      )}

      <Input
        label={t("transactions.form.accountLabel")}
        value={account}
        onChange={(e) => setAccount(e.target.value)}
        placeholder={t("transactions.form.accountPlaceholder")}
      />
      <Input label={t("transactions.form.dateLabel")} type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <div className="mb-3">
        <label className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
          {t("transactions.form.notesLabel")}
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder={t("transactions.form.notesPlaceholder")}
          className="w-full px-3.5 py-3 rounded-xl border border-border-strong bg-surface text-ink text-sm outline-none placeholder:text-ink-muted focus:border-brand transition-colors resize-none"
        />
      </div>

      <div className="flex gap-2">
        {secondaryAction}
        <Button fullWidth onClick={handleSubmit} disabled={saving}>
          {saving ? t("transactions.shared.saving") : submitLabel}
        </Button>
      </div>
    </>
  );
}
