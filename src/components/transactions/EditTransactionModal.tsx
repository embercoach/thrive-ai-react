import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import * as api from "@/services/api";
import type { Transaction } from "@/types";
import { TransactionForm, type TransactionFormValues } from "./TransactionForm";

interface EditTransactionModalProps {
  /** The row being edited; null closes the sheet. */
  transaction: Transaction | null;
  onClose: () => void;
}

export function EditTransactionModal({ transaction, onClose }: EditTransactionModalProps) {
  const { refetch, currency, transactions } = useAppData();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  function close() {
    setConfirmingDelete(false);
    setError("");
    onClose();
  }

  async function handleSave(values: TransactionFormValues) {
    if (!transaction) return;
    setSaving(true);
    setError("");
    const { error: dbError } = await api.updateTransaction(transaction.id, values);
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    // refetch is what makes Home, Spending, category totals, budget rows and
    // the AI's context all reflect the edit — every one of them derives from
    // the same useAppData transaction list.
    await refetch();
    close();
  }

  async function handleDelete(wholeSplit = false) {
    if (!transaction) return;
    setDeleting(true);
    setError("");
    const { error: dbError } =
      wholeSplit && transaction.split_group_id && user
        ? await api.deleteSplitGroup(user.id, transaction.split_group_id)
        : await api.deleteTransaction(transaction.id);
    setDeleting(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await refetch();
    close();
  }

  if (!transaction) return null;

  const siblings = transaction.split_group_id
    ? transactions.filter((t) => t.split_group_id === transaction.split_group_id)
    : [];
  const isSplit = siblings.length > 1;

  return (
    <Modal open onClose={close} title="Edit Transaction">
      {confirmingDelete ? (
        <div>
          <p className="text-sm text-ink mb-1.5">
            {isSplit ? "Delete part of this split?" : "Delete this transaction?"}
          </p>
          <p className="text-sm text-ink-secondary mb-4">
            {isSplit
              ? `"${transaction.name}" was split across ${siblings.length} categories. Removing just this part leaves the rest, so the split will no longer add up to what you actually spent.`
              : `"${transaction.name}" will be removed and your balance, category totals and budgets will recalculate. This can't be undone.`}
          </p>
          {error && <p className="text-negative text-sm mb-3">{error}</p>}
          <div className="flex flex-col gap-2">
            {isSplit && (
              <Button variant="danger" fullWidth onClick={() => handleDelete(true)} disabled={deleting}>
                {deleting ? "Deleting…" : `Delete all ${siblings.length} parts`}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                Keep it
              </Button>
              <Button variant="danger" fullWidth onClick={() => handleDelete(false)} disabled={deleting}>
                {deleting ? "Deleting…" : isSplit ? "Only this part" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {transaction.recurring_id && (
            <p className="text-[11px] text-ink-muted mb-3">
              Created by a recurring bill. Editing changes only this one entry, not the bill itself.
            </p>
          )}
          {isSplit && (
            <p className="text-[11px] text-ink-muted mb-3">
              One part of a {siblings.length}-way split. Changing the amount here won't adjust the
              other parts.
            </p>
          )}
          <TransactionForm
            initial={transaction}
            submitLabel="Save changes"
            saving={saving}
            error={error}
            currency={currency}
            onSubmit={handleSave}
            secondaryAction={
              <Button
                variant="outline"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                aria-label="Delete transaction"
              >
                <Trash2 size={15} />
              </Button>
            }
          />
        </>
      )}
    </Modal>
  );
}
