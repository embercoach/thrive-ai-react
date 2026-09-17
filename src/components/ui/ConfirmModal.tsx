import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A themed, in-app stand-in for the browser's native confirm() dialog.
 * Native confirm()/alert() block the page's own JS thread until answered —
 * they can't be styled to match the app, they render inconsistently across
 * browsers, and (worth knowing firsthand) they freeze any automated or
 * embedded context driving the page until a human dismisses them by hand.
 * Every "are you sure?" moment in the app should render one of these
 * instead of calling confirm() directly.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmVariant = "danger",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-ink-secondary mb-4">{message}</p>
      {error && (
        <p role="alert" className="text-negative text-sm mb-3">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="outline" fullWidth onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={confirmVariant} fullWidth onClick={onConfirm} disabled={loading}>
          {loading ? "…" : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
