import type { CategoryBudgetRow } from "@/hooks/useSpendingData";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { categoryIcon } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";

interface CategoryRowProps {
  row: CategoryBudgetRow;
  currency?: string;
  onClick?: () => void;
}

export function CategoryRow({ row, currency = "USD", onClick }: CategoryRowProps) {
  const Icon = categoryIcon(row.category);
  const ringColor = row.over ? "var(--color-negative)" : row.budget && row.budgetPct >= 80 ? "var(--color-warning)" : row.color;
  const statusText = row.budget
    ? row.over
      ? `${formatMoney(row.amount - row.budget, currency)} over budget`
      : `${formatMoney(row.budget - row.amount, currency)} left of budget`
    : "No budget set";

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-3 border-b border-border last:border-0 cursor-pointer"
    >
      <div className="relative w-9 h-9 flex-shrink-0">
        <ProgressRing percent={row.budget ? row.budgetPct : 100} size={34} strokeWidth={2.5} color={ringColor} />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon size={14} color={row.color} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink">{row.category}</div>
        <div className={`text-[11px] mt-0.5 ${row.over ? "text-negative" : "text-ink-muted"}`}>{statusText}</div>
      </div>
      <div className={`text-sm font-bold flex-shrink-0 ${row.over ? "text-negative" : "text-ink"}`}>
        {formatMoney(row.amount, currency)}
      </div>
    </div>
  );
}
