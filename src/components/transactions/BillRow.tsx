import type { RecurringItem } from "@/types";
import { categoryIcon, categoryColor } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";
import { parseLocalDate, todayLocal, daysBetween } from "@/utils/dates";

interface BillRowProps {
  bill: RecurringItem;
  currency?: string;
}

export function BillRow({ bill, currency = "USD" }: BillRowProps) {
  const Icon = categoryIcon(bill.category);
  const due = parseLocalDate(bill.next_date);
  const d = daysBetween(todayLocal(), due);
  const when = d < 0 ? "Overdue" : d === 0 ? "Today" : d === 1 ? "Tomorrow" : due.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-border last:border-0 first:pt-0 last:pb-0 text-sm">
      <div className="w-7 h-7 rounded-[9px] flex items-center justify-center flex-shrink-0 bg-surface-sunken">
        <Icon size={13} color={categoryColor(bill.category)} />
      </div>
      <span className="flex-1 text-ink font-medium">{bill.name}</span>
      <span className={`text-xs ${d < 0 ? "text-negative" : "text-ink-muted"}`}>{when}</span>
      <span className="font-bold text-ink">{formatMoney(Math.abs(bill.amount), currency)}</span>
    </div>
  );
}
