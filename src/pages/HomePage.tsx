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
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { Sparkline } from "@/components/charts/Sparkline";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { TransactionRow } from "@/components/transactions/TransactionRow";
import { BillRow } from "@/components/transactions/BillRow";
import { formatMoney } from "@/lib/currency";
import type { Goal } from "@/types";

function greeting(name?: string) {
  const h = new Date().getHours();
  const g = h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening";
  return `${g}${name ? `, ${name}` : ""} 👋`;
}

export function HomePage() {
  const navigate = useNavigate();
  const { profile, transactions, goals, recurring, budgets, currency, monthlyIncome, isPro, loading } = useAppData();
  const availableToSpend = useAvailableToSpend(transactions, recurring);
  const netWorth = useNetWorth(transactions);
  const sparkPoints = useSparklinePoints(transactions);
  const brief = useHomeBrief(transactions, goals, recurring, budgets, monthlyIncome, isPro, currency);
  const { hidden, toggle } = useBalanceVisibility();

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-ink-muted text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div>
      <TopBar greeting={greeting(profile?.name)} onBellClick={() => navigate("/profile")} />

      <div className="px-4 pt-3 flex flex-col gap-3.5 pb-4">
        {/* Hero */}
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                Available to spend
              </div>
              <div className="flex items-center gap-2">
                <span className="font-sans text-[40px] font-extrabold text-ink tracking-tight leading-none">
                  {hidden ? "••••••" : formatMoney(availableToSpend, currency)}
                </span>
                <button onClick={toggle} aria-label="Toggle balance visibility" className="text-ink-muted cursor-pointer">
                  {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>
            <Sparkline points={sparkPoints} />
          </div>

          <div className="mt-4 pt-3.5 border-t border-border">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-0.5">
              Total balance
            </div>
            <div className="font-sans text-[22px] font-extrabold text-ink tracking-tight">
              {hidden ? "••••" : formatMoney(netWorth, currency)}
            </div>
            {trendPct !== null && (
              <span
                className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full mt-1.5 ${
                  trendUp ? "bg-negative/12 text-negative" : "bg-positive/12 text-positive"
                }`}
              >
                {trendUp ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                {trendPct}% vs last week
              </span>
            )}
          </div>
        </Card>

        {/* Today's Brief */}
        <Card>
          <CardHeader title="Today's Brief" />
          {brief.length === 0 ? (
            <p className="text-sm text-ink-muted">Add a few transactions and I'll start giving you a daily brief here →</p>
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
          <CardHeader title="Upcoming Bills" action="View all" onActionClick={() => navigate("/spending")} />
          {upcomingBills.length === 0 ? (
            <p className="text-sm text-ink-muted">Add a recurring bill to track it here ›</p>
          ) : (
            upcomingBills.map((bill) => <BillRow key={bill.id} bill={bill} currency={currency} />)
          )}
        </Card>

        {/* Savings Progress */}
        <Card>
          <CardHeader title="Savings Progress" />
          {featuredGoal ? (
            <FeaturedGoalRing goal={featuredGoal} currency={currency} onClick={() => navigate("/goals")} />
          ) : (
            <p className="text-sm text-ink-muted">No goals yet — set one to start tracking ›</p>
          )}
        </Card>

        {/* Recent Transactions */}
        <Card padding="lg">
          <CardHeader title="Recent Transactions" action="See all" onActionClick={() => navigate("/spending")} />
          {recentTxns.length === 0 ? (
            <p className="text-sm text-ink-muted text-center py-2">No transactions yet</p>
          ) : (
            recentTxns.map((t) => <TransactionRow key={t.id} transaction={t} currency={currency} />)
          )}
        </Card>

        <button
          onClick={() => navigate("/ai")}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-brand text-ink-on-brand font-bold text-sm cursor-pointer hover:bg-brand-strong transition-colors"
        >
          <MessageCircle size={16} /> Ask Thrive
        </button>

        <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
          Educational purposes only · Not financial advice
        </p>
      </div>
    </div>
  );
}

// Small local component to keep the ring + text layout contained and reusable
// within Home specifically (a more compact treatment than the Goals page's
// FeaturedGoalCard, matching the reference's Home savings card).
function FeaturedGoalRing({ goal, currency, onClick }: { goal: Goal; currency: string; onClick: () => void }) {
  const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
  const encourage =
    pct >= 100
      ? "Goal complete! Incredible work."
      : pct >= 75
      ? "Almost there — keep going!"
      : pct >= 40
      ? "You're doing great! Keep going."
      : "Every contribution counts.";

  return (
    <div className="flex items-center gap-4 w-full cursor-pointer" onClick={onClick}>
      <ProgressRing percent={pct} size={66} strokeWidth={5} label={`${pct}%`} labelSize={15} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-ink">{goal.name}</div>
        <div className="text-xs text-ink-secondary">
          {formatMoney(goal.current, currency)} of {formatMoney(goal.target, currency)}
        </div>
        <div className="text-xs text-positive mt-0.5">{encourage}</div>
      </div>
    </div>
  );
}
