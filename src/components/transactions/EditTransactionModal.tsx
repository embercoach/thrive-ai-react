import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useI18n";
import * as api from "@/services/api";
import type { Transaction } from "@/types";
import { TransactionForm, type TransactionFormValues } from "./TransactionForm";

interface EditTransactionModalProps {
  /** The row being edited; null closes the sheet. */
  transaction: Transaction | null;
  onClose: () => void;
}

export function EditTransactionModal({ transaction, onClose }: EditTransactionModalProps) {
  const t = useT();
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
    if (!transaction || !user) return;
    setSaving(true);
    setError("");
    const { error: dbError } = await api.updateTransaction(user.id, transaction.id, values);
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
    if (!transaction || !user) return;
    setDeleting(true);
    setError("");
    const { error: dbError } =
      wholeSplit && transaction.split_group_id
        ? await api.deleteSplitGroup(user.id, transaction.split_group_id)
        : await api.deleteTransaction(user.id, transaction.id);
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
    ? transactions.filter((txn) => txn.split_group_id === transaction.split_group_id)
    : [];
  const isSplit = siblings.length > 1;

  return (
    <Modal open onClose={close} title={t("transactions.editModal.title")}>
      {confirmingDelete ? (
        <div>
          <p className="text-sm text-ink mb-1.5">
            {isSplit ? t("transactions.editModal.deletePartTitle") : t("transactions.editModal.deleteTitle")}
          </p>
          <p className="text-sm text-ink-secondary mb-4">
            {isSplit
              ? t("transactions.editModal.deleteSplitMessage", {
                  name: transaction.name,
                  count: siblings.length,
                })
              : t("transactions.editModal.deleteMessage", { name: transaction.name })}
          </p>
          {error && <p className="text-negative text-sm mb-3">{error}</p>}
          <div className="flex flex-col gap-2">
            {isSplit && (
              <Button variant="danger" fullWidth onClick={() => handleDelete(true)} disabled={deleting}>
                {deleting
                  ? t("transactions.shared.deleting")
                  : t("transactions.editModal.deleteAllParts", { count: siblings.length })}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setConfirmingDelete(false)} disabled={deleting}>
                {t("transactions.editModal.keepIt")}
              </Button>
              <Button variant="danger" fullWidth onClick={() => handleDelete(false)} disabled={deleting}>
                {deleting
                  ? t("transactions.shared.deleting")
                  : isSplit
                    ? t("transactions.editModal.onlyThisPart")
                    : t("transactions.shared.delete")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {transaction.recurring_id && (
            <p className="text-[11px] text-ink-muted mb-3">{t("transactions.editModal.recurringNotice")}</p>
          )}
          {isSplit && (
            <p className="text-[11px] text-ink-muted mb-3">
              {t("transactions.editModal.splitNotice", { count: siblings.length })}
            </p>
          )}
          <TransactionForm
            initial={transaction}
            submitLabel={t("transactions.editModal.saveChanges")}
            saving={saving}
            error={error}
            currency={currency}
            onSubmit={handleSave}
            secondaryAction={
              <Button
                variant="outline"
                onClick={() => setConfirmingDelete(true)}
                disabled={saving}
                aria-label={t("transactions.editModal.deleteTransactionAria")}
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
