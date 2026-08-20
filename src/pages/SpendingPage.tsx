import { useState } from "react";
import { Search, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "@/hooks/useAppData";
import { useSpendingData } from "@/hooks/useSpendingData";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DonutChart } from "@/components/charts/DonutChart";
import { CategoryRow } from "@/components/transactions/CategoryRow";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { BillRow } from "@/components/transactions/BillRow";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { ManageBudgetsModal } from "@/components/transactions/ManageBudgetsModal";
import { ManageRecurringModal } from "@/components/transactions/ManageRecurringModal";
import UpgradeModal from "@/components/profile/UpgradeModal";
import { formatMoney } from "@/lib/currency";

export function SpendingPage() {
  const navigate = useNavigate();
  const { transactions, budgets, recurring, currency } = useAppData();
  const { period, setPeriod, shownTxns, shownTotal, trendPct, breakdown, budgetRows } = useSpendingData(transactions, budgets);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState<string | undefined>(undefined);

  const upcomingRecurring = [...recurring].sort((a, b) => a.next_date.localeCompare(b.next_date));

  // With no search active the list follows the period toggle above — showing
  // "No spending recorded this period" over a list of this month's rows read
  // as a bug. Searching deliberately escapes the period and spans all time,
  // so history is still reachable; the heading below says which you're seeing.
  const filteredTxns = search
    ? transactions.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          (t.category || "").toLowerCase().includes(search.toLowerCase())
      )
    : shownTxns;

  const txnListTitle = search ? "Search results" : period === "this" ? "This Month" : "Last Month";

  function handleNeedUpgrade(trigger: string) {
    setUpgradeTrigger(trigger);
    setShowUpgradeModal(true);
  }

  return (
    <div className="px-4 pt-5 pb-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Spending</h1>
        <button onClick={() => setShowSearch((s) => !s)} aria-label="Search" className="text-ink-secondary cursor-pointer">
          <Search size={19} />
        </button>
      </div>

      <SegmentedControl
        options={[
          { value: "this", label: "This Month" },
          { value: "last", label: "Last Month" },
        ]}
        value={period}
        onChange={setPeriod}
      />

      <div className="flex items-start justify-between">
        <div>
          <div className="font-sans text-[34px] font-extrabold text-ink tracking-tight leading-none">
            {formatMoney(shownTotal, currency)}
          </div>
          {trendPct !== null && (
            <span
              className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full mt-2 ${
                trendPct > 0 ? "bg-negative/12 text-negative" : "bg-positive/12 text-positive"
              }`}
            >
              {trendPct > 0 ? "↑" : "↓"} {Math.abs(trendPct)}% vs last month
            </span>
          )}
        </div>
        <DonutChart segments={breakdown} total={shownTotal} />
      </div>

      <div>
        {breakdown.length === 0 ? (
          <p className="text-sm text-ink-muted">No spending recorded this period</p>
        ) : (
          breakdown.map((seg) => (
            <div
              key={seg.category}
              className="flex items-center gap-2 py-1.5 cursor-pointer"
              onClick={() => navigate(`/spending/${encodeURIComponent(seg.category)}`)}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: seg.color }} />
              <span className="flex-1 text-sm text-ink truncate">{seg.category}</span>
              <span className="text-sm font-semibold text-ink">{formatMoney(seg.amount, currency)}</span>
              <span className="text-xs text-ink-muted w-8 text-right">{seg.pct}%</span>
            </div>
          ))
        )}
      </div>

      {showSearch && (
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transactions…"
          className="w-full px-3.5 py-3 rounded-xl border border-border-strong bg-surface-sunken text-ink text-sm outline-none placeholder:text-ink-muted"
        />
      )}

      <Card>
        <CardHeader title="Recurring" action="Manage" onActionClick={() => setRecurringOpen(true)} />
        {upcomingRecurring.length === 0 ? (
          <p className="text-sm text-ink-muted">No recurring bills or income yet ›</p>
        ) : (
          upcomingRecurring.map((item) => <BillRow key={item.id} bill={item} currency={currency} />)
        )}
      </Card>

      <Card>
        <CardHeader title="Categories" action="Set budgets" onActionClick={() => setBudgetsOpen(true)} />
        {budgetRows.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-2">Add transactions to see categories</p>
        ) : (
          budgetRows.map((row) => (
            <CategoryRow
              key={row.category}
              row={row}
              currency={currency}
              onClick={() => navigate(`/spending/${encodeURIComponent(row.category)}`)}
            />
          ))
        )}
      </Card>

      <button
        onClick={() => setAddOpen(true)}
        className="flex items-center justify-center gap-1.5 py-3 rounded-xl border border-border-strong text-ink text-sm font-semibold cursor-pointer"
      >
        <Plus size={15} /> Add Transaction
      </button>

      <Card padding="lg">
        <CardHeader title={txnListTitle} />
        {filteredTxns.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-2">No transactions found</p>
        ) : (
          filteredTxns.map((t) => <TransactionRow key={t.id} transaction={t} currency={currency} />)
        )}
      </Card>

      <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
        Educational purposes only · Not financial advice
      </p>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ManageBudgetsModal
        open={budgetsOpen}
        onClose={() => setBudgetsOpen(false)}
        budgetRows={budgetRows}
        onNeedUpgrade={() => handleNeedUpgrade("budget categories")}
      />
      <ManageRecurringModal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        onNeedUpgrade={() => handleNeedUpgrade("recurring transactions")}
      />
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        triggeredBy={upgradeTrigger}
      />
    </div>
  );
}