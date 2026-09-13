import { useState } from "react";
import { Eye, EyeOff, ArrowUp, ArrowDown, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "@/hooks/useAppData";
import {
  useAvailableToSpend,
  useNetWorth,
  useSparklinePoints,
  useHomeBrief,
} from "@/hooks/useHomeMetrics";
import { useBalanceVisibility } from "@/hooks/useBalanceVisibility";
import { useT } from "@/hooks/useI18n";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { Sparkline } from "@/components/charts/Sparkline";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { EditTransactionModal } from "@/components/transactions/EditTransactionModal";
import { BillRow } from "@/components/transactions/BillRow";
import { HomeSkeleton } from "@/components/ui/HomeSkeleton";
import { formatMoney, formatMoneySigned } from "@/lib/currency";
import type { Goal, Transaction } from "@/types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

function greeting(t: Translate, name?: string) {
  const h = new Date().getHours();
  const g = h < 12 ? t("common.greetingMorning") : h < 17 ? t("common.greetingAfternoon") : t("common.greetingEvening");
  return `${g}${name ? `, ${name}` : ""} 👋`;
}

export function HomePage() {
  const navigate = useNavigate();
  const t = useT();
  const { profile, transactions, goals, recurring, budgets, currency, monthlyIncome, isPro, loading } = useAppData();
  const availableToSpend = useAvailableToSpend(transactions, recurring);
  const netWorth = useNetWorth(transactions);
  const sparkPoints = useSparklinePoints(transactions);
  const brief = useHomeBrief(transactions, goals, recurring, budgets, monthlyIncome, isPro, currency);
  const { hidden, toggle } = useBalanceVisibility();
  const [editing, setEditing] = useState<Transaction | null>(null);

  const trendUp = sparkPoints.length >= 2 ? sparkPoints[sparkPoints.length - 1] >= sparkPoints[0] : null;
  const trendPct =
    sparkPoints.length >= 2 && Math.abs(sparkPoints[0]) > 0.01
      ? Math.round(Math.abs((sparkPoints[sparkPoints.length - 1] - sparkPoints[0]) / sparkPoints[0]) * 100)
      : null;

  const featuredGoal = [...goals].sort(
    (a, b) => b.current / b.target - a.current / a.target
  )[0];
  const upcomingBills = [...recurring]
    .filter((r) => r.active !== false)
    .sort((a, b) => a.next_date.localeCompare(b.next_date))
    .slice(0, 3);
  const recentTxns = transactions.slice(0, 4);

  // In practice App.tsx's OnboardingGate already blocks rendering until the
  // first load completes, so this never fires in normal use — kept as a
  // defensive fallback (e.g. if HomePage is ever rendered standalone) rather
  // than assuming that gate is always present upstream.
  if (loading) {
    return <HomeSkeleton />;
  }

  return (
    <div>
      <TopBar greeting={greeting(t, profile?.name)} onBellClick={() => navigate("/profile")} />

      <div className="px-4 pt-3 flex flex-col gap-3.5 pb-4">
        {/* Hero */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                {t("home.availableToSpend")}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[40px] font-extrabold text-ink tracking-tight leading-none">
                  {hidden ? "••••••" : formatMoneySigned(availableToSpend, currency)}
                </span>
                <button onClick={toggle} aria-label={t("home.toggleBalanceAria")} className="text-ink-muted cursor-pointer">
                  {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <Sparkline points={sparkPoints} />
          </div>

          <div className="mt-4 pt-3.5 border-t border-border">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-0.5">
              {t("home.totalBalance")}
            </div>
            <div className="font-sans text-[22px] font-extrabold text-ink tracking-tight">
              {hidden ? "••••" : formatMoneySigned(netWorth, currency)}
            </div>
            {trendPct !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full mt-1.5 ${
                  trendUp ? "bg-negative/12 text-negative" : "bg-positive/12 text-positive"
                }`}
              >
                {trendUp ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {t("home.trendVsLastWeek", { pct: trendPct })}
              </span>
            )}
          </div>
        </Card>

        {/* Today's Brief */}
        <Card>
          <CardHeader title={t("home.todaysBrief")} />
          {brief.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("home.briefEmpty")}</p>
          ) : (
            <div>
              {brief.map((line, i) => {
                const Icon = line.icon;
                const toneColor =
                  line.tone === "positive"
                    ? "var(--color-positive)"
                    : line.tone === "negative"
                    ? "var(--color-negative)"
                    : "var(--color-warning)";
                return (
                  <div key={i} className="flex items-start gap-2.5 py-1.5 border-b border-border last:border-0 first:pt-0 last:pb-0">
                    <Icon size={14} color={toneColor} className="mt-0.5 flex-shrink-0" />
                    <span className="font-voice text-[15px] text-ink leading-relaxed">{line.text}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Upcoming Bills */}
        <Card>
          <CardHeader title={t("home.upcomingBills")} action={t("home.viewAll")} onActionClick={() => navigate("/spending")} />
          {upcomingBills.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("home.billsEmpty")}</p>
          ) : (
            upcomingBills.map((bill) => <BillRow key={bill.id} bill={bill} currency={currency} />)
          )}
        </Card>

        {/* Savings Progress */}
        <Card>
          <CardHeader title={t("home.savingsProgress")} />
          {featuredGoal ? (
            <FeaturedGoalRing goal={featuredGoal} currency={currency} onClick={() => navigate("/goals")} />
          ) : (
            <p className="text-sm text-ink-muted">{t("home.noGoalsYet")}</p>
          )}
        </Card>

        {/* Recent Transactions */}
        <Card padding="lg">
          <CardHeader title={t("home.recentTransactions")} action={t("home.seeAll")} onActionClick={() => navigate("/spending")} />
          {recentTxns.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-2">{t("home.noTransactionsYet")}</p>
          ) : (
            recentTxns.map((t) => (
              <TransactionRow key={t.id} transaction={t} currency={currency} onClick={() => setEditing(t)} />
            ))
          )}
        </Card>

        <button
          onClick={() => navigate("/ai")}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-brand text-ink-on-brand font-bold text-sm cursor-pointer hover:bg-brand-strong transition-colors"
        >
          <MessageCircle size={16} /> {t("home.askThrive")}
        </button>

        <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
          {t("common.educational")}
        </p>
      </div>

      <EditTransactionModal transaction={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

// Small local component to keep the ring + text layout contained and reusable
// within Home specifically (a more compact treatment than the Goals page's
// FeaturedGoalCard, matching the reference's Home savings card).
function FeaturedGoalRing({ goal, currency, onClick }: { goal: Goal; currency: string; onClick: () => void }) {
  const t = useT();
  const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
  const encourage =
    pct >= 100
      ? t("home.goalComplete")
      : pct >= 75
      ? t("home.goalAlmostThere")
      : pct >= 40
      ? t("home.goalDoingGreat")
      : t("home.goalEveryContribution");

  return (
    <div className="flex items-center gap-4 w-full cursor-pointer" onClick={onClick}>
      <ProgressRing percent={pct} size={66} strokeWidth={5} label={`${pct}%`} labelSize={15} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink">{goal.name}</div>
        <div className="text-xs text-ink-secondary">
          {t("home.goalOf", { current: formatMoney(goal.current, currency), target: formatMoney(goal.target, currency) })}
        </div>
        <div className="text-xs text-positive mt-0.5">{encourage}</div>
      </div>
    </div>
  );
}
