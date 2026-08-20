import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAppData } from "@/hooks/useAppData";
import { budgetFor } from "@/hooks/useSpendingData";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { TrendLine } from "@/components/charts/TrendLine";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { EditTransactionModal } from "@/components/transactions/EditTransactionModal";
import type { Transaction } from "@/types";
import { formatMoney } from "@/lib/currency";
import { categoryIcon } from "@/lib/categories";
import { parseLocalDate, todayLocal, normCategory, isSameMonth } from "@/utils/dates";

export function CategoryDetailPage() {
  const { category = "" } = useParams<{ category: string }>();
  const decodedCategory = decodeURIComponent(category);
  const navigate = useNavigate();
  const { transactions, budgets, currency } = useAppData();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const Icon = categoryIcon(decodedCategory);

  const today = todayLocal();
  const monthTxns = transactions.filter(
    (t) => isSameMonth(parseLocalDate(t.date), today) && t.amount < 0 && normCategory(t.category) === normCategory(decodedCategory)
  );
  const total = monthTxns.reduce((a, t) => a + Math.abs(t.amount), 0);
  const budget = budgetFor(budgets, decodedCategory);
  const pct = budget ? Math.round((total / budget) * 100) : 0;
  const over = !!budget && total > budget;

  // Weekly cumulative spend across the last 5 weeks, for the trend line.
  const weeks: Date[] = [];
  for (let i = 4; i >= 0; i--) {
    weeks.push(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 7));
  }
  const cumPoints = weeks.map((end) =>
    transactions
      .filter((t) => t.amount < 0 && normCategory(t.category) === normCategory(decodedCategory) && parseLocalDate(t.date) <= end)
      .reduce((a, t) => a + Math.abs(t.amount), 0)
  );
  const weekLabels = weeks.map((d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));

  const sorted = [...monthTxns].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime());
  const shown = sorted.slice(0, 5);
  const remaining = sorted.length - shown.length;

  return (
    <div className="pb-4">
      <div className="flex items-center gap-3 px-4 pt-5 pb-3">
        <button onClick={() => navigate("/spending")} aria-label="Back" className="text-ink cursor-pointer">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-ink-secondary" />
          <h1 className="text-lg font-bold text-ink">{decodedCategory}</h1>
        </div>
      </div>

      <div className="px-4 flex flex-col gap-4">
        <Card>
          <div className="text-2xl font-extrabold text-ink">{formatMoney(total, currency)}</div>
          {budget ? (
            <>
              <div className={`text-sm mt-1 mb-2 ${over ? "text-negative" : "text-ink-secondary"}`}>
                {pct}% of {formatMoney(budget, currency)} budget
              </div>
              <ProgressBar percent={Math.min(pct, 100)} color={over ? "var(--color-negative)" : "var(--color-positive)"} />
            </>
          ) : (
            <p className="text-sm text-ink-muted mt-1">No budget set for {decodedCategory}</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Spending Trend" />
          <TrendLine points={cumPoints} labels={weekLabels} currency={currency} />
        </Card>

        <Card padding="lg">
          <CardHeader title="Transactions" />
          {shown.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-2">No transactions this month</p>
          ) : (
            shown.map((t) => (
              <TransactionRow key={t.id} transaction={t} currency={currency} showDate onClick={() => setEditing(t)} />
            ))
          )}
        </Card>
        {remaining > 0 && (
          <button
            onClick={() => navigate("/spending")}
            className="text-sm text-brand font-semibold text-center cursor-pointer"
          >
            View all {sorted.length} {decodedCategory} transactions ›
          </button>
        )}

        <button
          onClick={() => navigate("/ai", { state: { prompt: `Tell me about my ${decodedCategory} spending this month` } })}
          className="w-full flex items-center justify-center py-3.5 rounded-full bg-brand text-ink-on-brand font-bold text-sm cursor-pointer hover:bg-brand-strong transition-colors"
        >
          Ask Thrive about this
        </button>

        <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
          Educational purposes only · Not financial advice
        </p>
      </div>

      <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
