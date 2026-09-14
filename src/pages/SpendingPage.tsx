import { useMemo, useState } from "react";
import type { Transaction } from "@/types";
import { Search, Plus, X, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "@/hooks/useAppData";
import { useSpendingData, matchesTypeFilter, type TxnTypeFilter } from "@/hooks/useSpendingData";
import { useT } from "@/hooks/useI18n";
import { categoryColor } from "@/lib/categories";
import { transactionsToCsv, downloadCsv } from "@/lib/csv";
import { todayLocalStr } from "@/utils/dates";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { DonutChart } from "@/components/charts/DonutChart";
import { CategoryRow } from "@/components/transactions/CategoryRow";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { BillRow } from "@/components/transactions/BillRow";
import { AddTransactionModal } from "@/components/transactions/AddTransactionModal";
import { EditTransactionModal } from "@/components/transactions/EditTransactionModal";
import { ManageBudgetsModal } from "@/components/transactions/ManageBudgetsModal";
import { ManageRecurringModal } from "@/components/transactions/ManageRecurringModal";
import UpgradeModal from "@/components/profile/UpgradeModal";
import { formatMoney } from "@/lib/currency";

export function SpendingPage() {
  const navigate = useNavigate();
  const t = useT();
  const { transactions, budgets, recurring, currency } = useAppData();
  const { period, setPeriod, shownTxns, shownAllTxns, shownTotal, trendPct, breakdown, budgetRows } = useSpendingData(
    transactions,
    budgets
  );
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TxnTypeFilter>("expense");
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [budgetsOpen, setBudgetsOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState<string | undefined>(undefined);

  const upcomingRecurring = [...recurring].sort((a, b) => a.next_date.localeCompare(b.next_date));

  // Every category seen in this account's history, most-used first, so the
  // chip row is stable and relevant regardless of what's currently filtered.
  const availableCategories = useMemo(() => {
    const counts = new Map<string, number>();
    transactions.forEach((t) => {
      const cat = t.category || "Other";
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([cat]) => cat);
  }, [transactions]);

  const hasSearch = search.trim().length > 0;
  const hasCategoryFilter = activeCategories.size > 0;
  const hasTypeFilter = typeFilter !== "expense";
  const hasActiveFilter = hasSearch || hasCategoryFilter || hasTypeFilter;

  // With no search active the list follows the period toggle above — showing
  // "No spending recorded this period" over a list of this month's rows read
  // as a bug. Searching deliberately escapes the period and spans all time,
  // so history is still reachable; the heading below says which you're seeing.
  // The type filter needs the same escape hatch: switching to "Income" while
  // still period-bound uses the income-inclusive pool for that same month
  // instead of the expenses-only one everything else on this page relies on.
  const basePool = hasSearch ? transactions : typeFilter === "expense" ? shownTxns : shownAllTxns;

  const filteredTxns = basePool.filter((t) => {
    const matchesSearch =
      !hasSearch ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.category || "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !hasCategoryFilter || activeCategories.has(t.category || "Other");
    return matchesSearch && matchesCategory && matchesTypeFilter(t, typeFilter);
  });

  const txnListTitle = hasSearch ? t("spending.searchResults") : period === "this" ? t("spending.periodThis") : t("spending.periodLast");

  function toggleCategory(cat: string) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("expense");
    setActiveCategories(new Set());
  }

  function handleNeedUpgrade(trigger: string) {
    setUpgradeTrigger(trigger);
    setShowUpgradeModal(true);
  }

  // Exports the account's full transaction history, not just what's
  // currently filtered/on-screen — a data export should be a complete
  // backup a user can take with them, not a snapshot of one search.
  function handleExport() {
    if (transactions.length === 0) return;
    downloadCsv(`thrive-transactions-${todayLocalStr()}.csv`, transactionsToCsv(transactions));
  }

  return (
    <div className="px-4 pt-5 pb-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t("spending.title")}</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExport}
            disabled={transactions.length === 0}
            aria-label={t("spending.exportAria")}
            className="text-ink-secondary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Download size={19} />
          </button>
          <button
            onClick={() => setShowSearch((s) => !s)}
            aria-label={t("spending.searchFilterAria")}
            className="relative text-ink-secondary cursor-pointer"
          >
            <Search size={19} />
            {hasActiveFilter && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-brand" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <SegmentedControl
        options={[
          { value: "this", label: t("spending.periodThis") },
          { value: "last", label: t("spending.periodLast") },
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
              {trendPct > 0 ? "↑" : "↓"} {t("spending.trendVsLastMonth", { pct: Math.abs(trendPct) })}
            </span>
          )}
        </div>
        <DonutChart segments={breakdown} total={shownTotal} />
      </div>

      <div>
        {breakdown.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("spending.noSpendingPeriod")}</p>
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
        <div className="flex flex-col gap-3">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("spending.searchPlaceholder")}
            className="w-full px-3.5 py-3 rounded-xl border border-border-strong bg-surface-sunken text-ink text-sm outline-none placeholder:text-ink-muted"
          />

          <SegmentedControl
            options={[
              { value: "expense", label: t("spending.filterExpenses") },
              { value: "income", label: t("spending.filterIncome") },
              { value: "all", label: t("spending.filterAll") },
            ]}
            value={typeFilter}
            onChange={setTypeFilter}
          />

          {availableCategories.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableCategories.map((cat) => {
                const active = activeCategories.has(cat);
                const color = categoryColor(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer border transition-colors"
                    style={
                      active
                        ? { backgroundColor: color, borderColor: color, color: "var(--color-ink-on-brand)" }
                        : { borderColor: "var(--color-border-strong)", color: "var(--color-ink-secondary)" }
                    }
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          )}

          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="self-start flex items-center gap-1 text-xs font-semibold text-ink-secondary cursor-pointer"
            >
              <X size={12} /> {t("spending.clearFilters")}
            </button>
          )}
        </div>
      )}

      <Card>
        <CardHeader title={t("spending.recurring")} action={t("spending.manage")} onActionClick={() => setRecurringOpen(true)} />
        {upcomingRecurring.length === 0 ? (
          <p className="text-sm text-ink-muted">{t("spending.noRecurring")}</p>
        ) : (
          upcomingRecurring.map((item) => <BillRow key={item.id} bill={item} currency={currency} />)
        )}
      </Card>

      <Card>
        <CardHeader title={t("spending.categories")} action={t("spending.setBudgets")} onActionClick={() => setBudgetsOpen(true)} />
        {budgetRows.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-2">{t("spending.noCategories")}</p>
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
        <Plus size={15} /> {t("spending.addTransaction")}
      </button>

      <Card padding="lg">
        <CardHeader title={txnListTitle} />
        {filteredTxns.length === 0 ? (
          <p className="text-sm text-ink-muted text-center py-2">{t("spending.noTransactionsFound")}</p>
        ) : (
          filteredTxns.map((t) => (
            <TransactionRow key={t.id} transaction={t} currency={currency} onClick={() => setEditing(t)} />
          ))
        )}
      </Card>

      <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
        {t("common.educational")}
      </p>

      <AddTransactionModal open={addOpen} onClose={() => setAddOpen(false)} />
      <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} />
      <ManageBudgetsModal
        open={budgetsOpen}
        onClose={() => setBudgetsOpen(false)}
        budgetRows={budgetRows}
        onNeedUpgrade={() => handleNeedUpgrade("budgetCategories")}
      />
      <ManageRecurringModal
        open={recurringOpen}
        onClose={() => setRecurringOpen(false)}
        onNeedUpgrade={() => handleNeedUpgrade("recurringTransactions")}
      />
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        triggeredBy={upgradeTrigger}
      />
    </div>
  );
}
