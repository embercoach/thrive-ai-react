import { Repeat, SplitSquareHorizontal, StickyNote } from "lucide-react";
import type { Transaction } from "@/types";
import { categoryIcon, categoryColor } from "@/lib/categories";
import { formatMoney } from "@/lib/currency";
import { parseLocalDate } from "@/utils/dates";

interface TransactionRowProps {
  transaction: Transaction;
  currency?: string;
  showDate?: boolean;
  onClick?: () => void;
}

export function TransactionRow({ transaction, currency = "USD", showDate = true, onClick }: TransactionRowProps) {
  const Icon = categoryIcon(transaction.category);
  const isIncome = transaction.amount > 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-2.5 py-2.5 border-b border-border last:border-0 first:pt-0 last:pb-0"
      style={{ cursor: onClick ? "pointer" : undefined }}
    >
      <div
        className="w-8 h-8 rounded-[9px] flex items-center justify-center flex-shrink-0 bg-surface-sunken"
      >
        <Icon size={15} color={categoryColor(transaction.category)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink truncate flex items-center gap-1">
          {transaction.name}
          {transaction.recurring_id && <Repeat size={10} className="text-ink-muted flex-shrink-0" />}
          {transaction.split_group_id && (
            <SplitSquareHorizontal size={10} className="text-ink-muted flex-shrink-0" aria-label="Part of a split" />
          )}
          {transaction.notes && (
            <StickyNote size={10} className="text-ink-muted flex-shrink-0" aria-label="Has notes" />
          )}
        </div>
        {showDate && (
          <div className="text-xs text-ink-muted truncate">
            {parseLocalDate(transaction.date).toLocaleDateString()} · {transaction.category || "Other"}
            {transaction.account ? ` · ${transaction.account}` : ""}
          </div>
        )}
      </div>
      <div className={`text-sm font-bold flex-shrink-0 ${isIncome ? "text-positive" : "text-ink"}`}>
        {isIncome ? "+" : "−"}
        {formatMoney(transaction.amount, currency)}
      </div>
    </div>
  );
}
