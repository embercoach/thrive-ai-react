import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Transaction } from "@/types";
import { todayLocalStr } from "@/utils/dates";

export interface TransactionFormValues {
  name: string;
  amount: number; // signed: negative = expense, positive = income
  category: string;
  date: string; // YYYY-MM-DD
}

interface TransactionFormProps {
  /** Existing row when editing; omit when adding. */
  initial?: Transaction;
  submitLabel: string;
  saving: boolean;
  error?: string;
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
  onSubmit,
  secondaryAction,
}: TransactionFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [amount, setAmount] = useState(initial ? String(Math.abs(initial.amount)) : "");
  const [type, setType] = useState<"expense" | "income">(
    initial && initial.amount > 0 ? "income" : "expense"
  );
  const [category, setCategory] = useState(initial?.category ?? "");
  const [date, setDate] = useState(initial?.date ?? todayLocalStr());
  const [localError, setLocalError] = useState("");

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!name.trim() || !amt) {
      setLocalError("Please fill in name and amount.");
      return;
    }
    setLocalError("");
    onSubmit({
      name: name.trim(),
      amount: type === "expense" ? -Math.abs(amt) : Math.abs(amt),
      category: category.trim() || "Other",
      date,
    });
  }

  const shownError = error || localError;

  return (
    <>
      {shownError && <p className="text-negative text-sm mb-3">{shownError}</p>}
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
      <div className="flex gap-2">
        {secondaryAction}
        <Button fullWidth onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </>
  );
}
