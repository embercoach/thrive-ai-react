import { Wallet, Receipt, RefreshCw, Target, type LucideIcon } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import type { IntakeAction } from "@/types";
import type { IntakeStatus } from "@/hooks/useChat";

interface IntakePreviewCardProps {
  actions: IntakeAction[];
  status: IntakeStatus;
  note?: string;
  currency?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

const TYPE_LABEL: Record<IntakeAction["type"], string> = {
  monthly_income: "Monthly income",
  transaction: "Transaction",
  recurring: "Recurring",
  goal: "Goal",
};

const TYPE_ICON: Record<IntakeAction["type"], LucideIcon> = {
  monthly_income: Wallet,
  transaction: Receipt,
  recurring: RefreshCw,
  goal: Target,
};

export function IntakePreviewCard({ actions, status, note, currency = "USD", onConfirm, onDismiss }: IntakePreviewCardProps) {
  const busy = status === "confirming";
  const done = status === "confirmed" || status === "partial";

  return (
    <div className="flex gap-2 items-start">
      <div className="w-6.5 h-6.5 rounded-lg bg-brand flex-shrink-0 mt-0.5 flex items-center justify-center overflow-hidden">
        <div className="w-[42%] h-[42%] bg-canvas" style={{ clipPath: "polygon(0 0,72% 0,100% 28%,100% 100%,0 100%)" }} />
      </div>
      <div className="bg-surface border border-border rounded-2xl rounded-tl-md p-3.5 max-w-[86%] shadow-card">
        <div className="text-[9px] font-bold uppercase tracking-wide text-ink-muted mb-2">Add to your account</div>
        {actions.map((a, i) => {
          const Icon = TYPE_ICON[a.type];
          const amt = a.type === "goal" ? a.target : a.amount;
          const isPositive = (amt ?? 0) > 0;
          return (
            <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0">
              <div className="w-6.5 h-6.5 rounded-lg bg-brand/12 flex items-center justify-center flex-shrink-0">
                <Icon size={12} className="text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-ink truncate">{a.name || TYPE_LABEL[a.type]}</div>
                <div className="text-[10px] text-ink-muted">
                  {TYPE_LABEL[a.type]}
                  {a.category ? ` · ${a.category}` : ""}
                  {a.frequency ? ` · ${a.frequency}` : ""}
                </div>
              </div>
              {typeof amt === "number" && (
                <span className={`text-sm font-bold flex-shrink-0 ${isPositive ? "text-positive" : "text-ink"}`}>
                  {isPositive ? "+" : "−"}
                  {formatMoney(amt, currency)}
                </span>
              )}
            </div>
          );
        })}
        {note && <p className="text-sm text-ink-secondary mt-2 pt-2 border-t border-border">{note}</p>}
        {!done && (
          <div className="flex gap-2 mt-2.5">
            <Button variant="outline" size="sm" className="flex-1" onClick={onDismiss} disabled={busy}>
              Not now
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={onConfirm} disabled={busy}>
              {busy ? "Adding…" : "Add to my account"}
            </Button>
          </div>
        )}
        {done && (
          <div className="flex items-center gap-1.5 mt-2.5 text-sm font-semibold text-brand">
            <span>✓</span> {status === "confirmed" ? "Added" : "Partially added"}
          </div>
        )}
      </div>
    </div>
  );
}
