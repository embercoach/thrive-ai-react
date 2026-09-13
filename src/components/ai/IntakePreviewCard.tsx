import { Wallet, Receipt, RefreshCw, Target, type LucideIcon } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/Button";
import type { IntakeAction } from "@/types";
import type { IntakeStatus } from "@/hooks/useChat";
import { useT } from "@/hooks/useI18n";

interface IntakePreviewCardProps {
  actions: IntakeAction[];
  status: IntakeStatus;
  note?: string;
  currency?: string;
  onConfirm: () => void;
  onDismiss: () => void;
}

function typeLabels(t: ReturnType<typeof useT>): Record<IntakeAction["type"], string> {
  return {
    monthly_income: t("aiComponents.intakePreview.typeLabels.monthlyIncome"),
    transaction: t("aiComponents.intakePreview.typeLabels.transaction"),
    recurring: t("aiComponents.intakePreview.typeLabels.recurring"),
    goal: t("aiComponents.intakePreview.typeLabels.goal"),
  };
}

const TYPE_ICON: Record<IntakeAction["type"], LucideIcon> = {
  monthly_income: Wallet,
  transaction: Receipt,
  recurring: RefreshCw,
  goal: Target,
};

export function IntakePreviewCard({ actions, status, note, currency = "USD", onConfirm, onDismiss }: IntakePreviewCardProps) {
  const t = useT();
  const TYPE_LABEL = typeLabels(t);
  const busy = status === "confirming";
  const done = status === "confirmed" || status === "partial";

  return (
    <div className="flex gap-2 items-start">
      <div className="w-6.5 h-6.5 rounded-lg bg-brand flex-shrink-0 mt-0.5 flex items-center justify-center overflow-hidden">
        <div className="w-[42%] h-[42%] bg-canvas" style={{ clipPath: "polygon(0 0,72% 0,100% 28%,100% 100%,0 100%)" }} />
      </div>
      <div className="bg-surface border border-border rounded-2xl rounded-tl-md p-3.5 max-w-[86%] shadow-card">
        <div className="text-[9px] font-bold uppercase tracking-wide text-ink-muted mb-2">{t("aiComponents.intakePreview.addToAccount")}</div>
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
              {t("aiComponents.intakePreview.notNow")}
            </Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={onConfirm} disabled={busy}>
              {busy ? t("aiComponents.intakePreview.adding") : t("aiComponents.intakePreview.addToMyAccount")}
            </Button>
          </div>
        )}
        {done && (
          <div className="flex items-center gap-1.5 mt-2.5 text-sm font-semibold text-brand">
            <span>✓</span> {status === "confirmed" ? t("aiComponents.intakePreview.added") : t("aiComponents.intakePreview.partiallyAdded")}
          </div>
        )}
      </div>
    </div>
  );
}
