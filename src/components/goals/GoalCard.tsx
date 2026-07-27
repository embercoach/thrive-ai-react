import { Trophy, Target, X } from "lucide-react";
import type { Goal } from "@/types";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatMoney } from "@/lib/currency";

function encouragement(pct: number): string {
  if (pct >= 100) return "Goal complete! Incredible work.";
  if (pct >= 75) return "Almost there — keep going!";
  if (pct >= 40) return "You're doing great! Keep going.";
  return "Every contribution counts.";
}

interface FeaturedGoalCardProps {
  goal: Goal;
  currency?: string;
  onAddSavings?: () => void;
  onAskAI?: () => void;
  onDelete?: () => void;
}

/** The large hero ring shown once on Home and at the top of Goals. */
export function FeaturedGoalCard({ goal, currency = "USD", onAddSavings, onAskAI, onDelete }: FeaturedGoalCardProps) {
  const pct = Math.round((goal.current / goal.target) * 100);
  const isComplete = pct >= 100;

  return (
    <div>
      <div className="flex items-start justify-between mb-3.5">
        <h3 className="text-[15px] font-extrabold text-ink">{goal.name}</h3>
        {onDelete && (
          <button onClick={onDelete} aria-label="Delete goal" className="text-ink-muted cursor-pointer">
            <X size={15} />
          </button>
        )}
      </div>
      <div className="flex items-center gap-4">
        <ProgressRing
          percent={pct}
          size={88}
          strokeWidth={6}
          color="var(--color-positive)"
          label={`${pct}%`}
          labelSize={19}
        />
        <div className="flex-1 min-w-0">
          <div className="text-lg font-extrabold text-ink">{formatMoney(goal.current, currency)}</div>
          <div className="text-sm text-ink-secondary mb-1">of {formatMoney(goal.target, currency)}</div>
          {goal.deadline && (
            <div className="text-xs text-ink-muted">
              Target date {new Date(`${goal.deadline}T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </div>
          )}
        </div>
      </div>
      <p className="text-sm text-positive mt-3">{encouragement(pct)}</p>
      {(onAddSavings || onAskAI) && (
        <div className="flex gap-2 mt-3">
          {onAddSavings && (
            <button
              onClick={onAddSavings}
              className="flex-1 py-2 px-3 rounded-xl bg-brand/12 border border-brand/30 text-brand text-xs font-bold cursor-pointer"
            >
              + Add Savings
            </button>
          )}
          {onAskAI && (
            <button
              onClick={onAskAI}
              className="flex-1 py-2 px-3 rounded-xl bg-info/10 border border-info/30 text-info text-xs font-bold cursor-pointer"
            >
              Ask Thrive AI
            </button>
          )}
        </div>
      )}
      {isComplete && (
        <div className="flex items-center gap-1.5 text-brand text-xs font-bold mt-2">
          <Trophy size={13} /> Complete
        </div>
      )}
    </div>
  );
}

interface CompactGoalRowProps {
  goal: Goal;
  onClick?: () => void;
  onDelete?: () => void;
}

/** The smaller list row used for every goal after the featured one. */
export function CompactGoalRow({ goal, onClick, onDelete }: CompactGoalRowProps) {
  const pct = Math.round((goal.current / goal.target) * 100);
  const isComplete = pct >= 100;
  const Icon = isComplete ? Trophy : Target;

  return (
    <div className="flex items-center gap-3 py-3">
      <button
        onClick={onClick}
        className="w-9 h-9 rounded-[11px] bg-surface-sunken flex items-center justify-center flex-shrink-0 text-ink-secondary cursor-pointer"
      >
        <Icon size={16} />
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="text-sm font-semibold text-ink">{goal.name}</div>
        <ProgressBar percent={pct} className="mt-1.5" />
      </div>
      <div className="text-sm font-bold text-ink flex-shrink-0 cursor-pointer" onClick={onClick}>
        {pct}%
      </div>
      {onDelete && (
        <button onClick={onDelete} aria-label="Delete goal" className="text-ink-muted p-0.5 cursor-pointer flex-shrink-0">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
