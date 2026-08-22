import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import * as api from "@/services/api";
import { TransactionForm, type TransactionFormValues } from "./TransactionForm";

interface AddTransactionModalProps {
  open: boolean;
  onClose: () => void;
}

export function AddTransactionModal({ open, onClose }: AddTransactionModalProps) {
  const { user } = useAuth();
  const { currency, refetch } = useAppData();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // Remounts the form on each open so it comes back blank rather than
  // holding the previous entry's values.
  const [formKey, setFormKey] = useState(0);

  async function handleSave(values: TransactionFormValues) {
    if (!user) return;
    setSaving(true);
    setError("");

    const { splits, ...base } = values;
    let dbError;

    if (splits && splits.length > 1) {
      // One insert, so a half-written split can never exist — the legs of a
      // shop must always add up to what was actually spent.
      const groupId = crypto.randomUUID();
      ({ error: dbError } = await api.addTransactionSplit(
        splits.map((leg) => ({
          user_id: user.id,
          ...base,
          category: leg.category,
          amount: leg.amount,
          split_group_id: groupId,
          currency,
        }))
      ));
    } else {
      ({ error: dbError } = await api.addTransaction({
        user_id: user.id,
        ...base,
        currency,
      }));
    }

    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    setFormKey((k) => k + 1);
    onClose();
    await refetch();
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Transaction">
      <TransactionForm
        key={formKey}
        submitLabel="Add Transaction"
        saving={saving}
        error={error}
        currency={currency}
        allowSplit
        onSubmit={handleSave}
      />
    </Modal>
  );
}
