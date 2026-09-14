import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useT } from "@/hooks/useI18n";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /**
   * Blocks the backdrop click and the X button from closing the modal.
   * Use while an in-flight save reads-then-writes a value from props (e.g.
   * "current + amount"): closing mid-save lets the user reopen the modal
   * before the parent's data has refetched, so the next save computes from
   * the same stale base value and silently drops the first contribution.
   * Keeping the modal open until the save (and its refetch) finish closes
   * that window.
   */
  preventClose?: boolean;
}

export function Modal({ open, onClose, title, children, preventClose }: ModalProps) {
  const t = useT();

  // Locks the background page from scrolling while the sheet is open.
  // Without this, a touch/wheel scroll on a long list behind the modal
  // (e.g. SpendingPage's transaction list) moves the page's scroll position
  // underneath it, which only becomes visible once the modal closes and
  // nothing has restored where the page was.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  const requestClose = () => {
    if (!preventClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && requestClose()}
    >
      <div
        className={cn(
          "w-full max-w-[430px] bg-surface border-t border-border rounded-t-3xl p-6 pb-9 animate-sheet-up"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            onClick={requestClose}
            disabled={preventClose}
            className="w-7 h-7 rounded-full bg-surface-sunken flex items-center justify-center text-ink cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={t("common.close")}
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
