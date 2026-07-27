import { useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "@/hooks/useAppData";
import { FeaturedGoalCard, CompactGoalRow } from "@/components/goals/GoalCard";
import { AddGoalModal } from "@/components/goals/AddGoalModal";
import { ContributeGoalModal } from "@/components/goals/ContributeGoalModal";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import * as api from "@/services/api";
import type { Goal } from "@/types";

export function GoalsPage() {
  const navigate = useNavigate();
  const { goals, currency, refetch } = useAppData();
  const [addOpen, setAddOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);

  const sorted = [...goals].sort((a, b) => b.current / b.target - a.current / a.target);
  const featured = sorted[0];
  const rest = sorted.slice(1);

  async function handleDelete(goal: Goal) {
    if (!confirm(`Delete "${goal.name}"?`)) return;
    await api.deleteGoal(goal.id);
    await refetch();
  }

  return (
    <div className="px-4 pt-5 pb-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Goals</h1>
        <button onClick={() => setAddOpen(true)} aria-label="Add goal" className="text-ink-secondary cursor-pointer">
          <Plus size={22} />
        </button>
      </div>

      {!featured ? (
        <Card>
          <p className="text-sm text-ink-secondary text-center mb-3">No goals yet. Set your first financial goal!</p>
          <button
            onClick={() => setAddOpen(true)}
            className="mx-auto flex items-center gap-1.5 py-2 px-4 rounded-xl bg-brand/12 border border-brand/30 text-brand text-xs font-bold cursor-pointer"
          >
            <Plus size={14} /> Add First Goal
          </button>
        </Card>
      ) : (
        <Card>
          <FeaturedGoalCard
            goal={featured}
            currency={currency}
            onAddSavings={() => setContributeGoal(featured)}
            onAskAI={() => navigate("/ai")}
            onDelete={() => handleDelete(featured)}
          />
        </Card>
      )}

      {rest.length > 0 && (
        <Card padding="lg">
          <CardHeader title="All Goals" />
          {rest.map((g) => (
            <CompactGoalRow
              key={g.id}
              goal={g}
              onClick={() => setContributeGoal(g)}
              onDelete={() => handleDelete(g)}
            />
          ))}
        </Card>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-2">What If</div>
        <Card padding="md" interactive onClick={() => navigate("/ai")} className="mb-2">
          <p className="font-voice text-sm text-ink mb-1">"How do I reach my goals faster?"</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-secondary">Ask Thrive AI →</p>
        </Card>
        <Card padding="md" interactive onClick={() => navigate("/ai")}>
          <p className="font-voice text-sm text-ink mb-1">"Should I pay debt or save first?"</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-secondary">Ask Thrive AI →</p>
        </Card>
      </div>

      <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
        Educational purposes only · Not financial advice
      </p>

      <AddGoalModal open={addOpen} onClose={() => setAddOpen(false)} onNeedUpgrade={() => navigate("/profile")} />
      <ContributeGoalModal goal={contributeGoal} onClose={() => setContributeGoal(null)} />
    </div>
  );
}
