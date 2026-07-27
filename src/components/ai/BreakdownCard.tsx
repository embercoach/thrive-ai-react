import type { Breakdown } from "@/types";
import { categoryIcon, categoryColor } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";
import { Button } from "@/components/ui/Button";

interface BreakdownCardProps {
  breakdown: Breakdown;
  currency?: string;
  onViewTransactions: () => void;
  onSeeFullAnalysis: () => void;
}

export function BreakdownCard({ breakdown, currency = "USD", onViewTransactions, onSeeFullAnalysis }: BreakdownCardProps) {
  return (
    <div className="flex gap-2 items-start">
      <div className="w-6.5 h-6.5 rounded-lg bg-brand flex-shrink-0 mt-0.5 flex items-center justify-center overflow-hidden">
        <div className="w-[42%] h-[42%] bg-canvas" style={{ clipPath: "polygon(0 0,72% 0,100% 28%,100% 100%,0 100%)" }} />
      </div>
      <div className="bg-surface border border-border rounded-2xl rounded-tl-md p-3.5 max-w-[86%] shadow-card">
        {breakdown.items.map((item, i) => {
          const Icon = categoryIcon(item.category);
          const isIncome = item.amount > 0;
          return (
            <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-border last:border-0">
              <div
                className="w-6.5 h-6.5 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `color-mix(in srgb, ${categoryColor(item.category)} 15%, transparent)` }}
              >
                <Icon size={12} color={categoryColor(item.category)} />
              </div>
              <span className="flex-1 text-sm text-ink min-w-0">{item.label}</span>
              <span className={`text-sm font-bold flex-shrink-0 ${isIncome ? "text-positive" : "text-ink"}`}>
                {isIncome ? "+" : "−"}
                {formatMoney(item.amount, currency)}
              </span>
            </div>
          );
        })}
        {breakdown.outro && (
          <p className="text-sm text-ink-secondary mt-2 pt-2 border-t border-border">{breakdown.outro}</p>
        )}
        <div className="flex gap-2 mt-2.5">
          <Button variant="info" size="sm" className="flex-1" onClick={onViewTransactions}>
            View Transactions
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onSeeFullAnalysis}>
            See Full Analysis
          </Button>
        </div>
      </div>
    </div>
  );
}
