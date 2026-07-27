import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-overlay backdrop-blur-sm animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={cn(
          "w-full max-w-[430px] bg-surface border-t border-border rounded-t-3xl p-6 pb-9 animate-sheet-up"
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-surface-sunken flex items-center justify-center text-ink cursor-pointer"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
