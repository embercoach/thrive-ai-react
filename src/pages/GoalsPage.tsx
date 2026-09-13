import { useState } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppData } from "@/hooks/useAppData";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useI18n";
import { FeaturedGoalCard, CompactGoalRow } from "@/components/goals/GoalCard";
import { AddGoalModal } from "@/components/goals/AddGoalModal";
import { ContributeGoalModal } from "@/components/goals/ContributeGoalModal";
import { Card } from "@/components/ui/Card";
import { CardHeader } from "@/components/ui/CardHeader";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import UpgradeModal from "@/components/profile/UpgradeModal";
import * as api from "@/services/api";
import type { Goal } from "@/types";

export function GoalsPage() {
  const navigate = useNavigate();
  const t = useT();
  const { user } = useAuth();
  const { goals, currency, refetch } = useAppData();
  const [addOpen, setAddOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const sorted = [...goals].sort((a, b) => b.current / b.target - a.current / a.target);
  const featured = sorted[0];
  const rest = sorted.slice(1);

  function closeDeleteModal() {
    setDeleteTarget(null);
    setDeleteError("");
  }

  async function handleDelete() {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    setDeleteError("");
    const { error } = await api.deleteGoal(user.id, deleteTarget.id);
    setDeleting(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    closeDeleteModal();
    await refetch();
  }

  return (
    <div className="px-4 pt-5 pb-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">{t("goals.title")}</h1>
        <button onClick={() => setAddOpen(true)} aria-label={t("goals.addAria")} className="text-ink-secondary cursor-pointer">
          <Plus size={22} />
        </button>
      </div>

      {!featured ? (
        <Card>
          <p className="text-sm text-ink-secondary text-center mb-3">{t("goals.noGoalsMessage")}</p>
          <button
            onClick={() => setAddOpen(true)}
            className="mx-auto flex items-center gap-1.5 py-2 px-4 rounded-xl bg-brand/12 border border-brand/30 text-brand text-xs font-bold cursor-pointer"
          >
            <Plus size={14} /> {t("goals.addFirstGoal")}
          </button>
        </Card>
      ) : (
        <Card>
          <FeaturedGoalCard
            goal={featured}
            currency={currency}
            onAddSavings={() => setContributeGoal(featured)}
            onAskAI={() => navigate("/ai")}
            onDelete={() => setDeleteTarget(featured)}
          />
        </Card>
      )}

      {rest.length > 0 && (
        <Card padding="lg">
          <CardHeader title={t("goals.allGoals")} />
          {rest.map((g) => (
            <CompactGoalRow
              key={g.id}
              goal={g}
              onClick={() => setContributeGoal(g)}
              onDelete={() => setDeleteTarget(g)}
            />
          ))}
        </Card>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-2">{t("goals.whatIf")}</div>
        <Card padding="md" interactive onClick={() => navigate("/ai")} className="mb-2">
          <p className="font-voice text-sm text-ink mb-1">{t("goals.whatIfQ1")}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-secondary">{t("goals.askThriveArrow")}</p>
        </Card>
        <Card padding="md" interactive onClick={() => navigate("/ai")}>
          <p className="font-voice text-sm text-ink mb-1">{t("goals.whatIfQ2")}</p>
          <p className="text-[10px] font-bold uppercase tracking-wide text-ink-secondary">{t("goals.askThriveArrow")}</p>
        </Card>
      </div>

      <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
        {t("common.educational")}
      </p>

      <AddGoalModal open={addOpen} onClose={() => setAddOpen(false)} onNeedUpgrade={() => setShowUpgradeModal(true)} />
      <ContributeGoalModal goal={contributeGoal} onClose={() => setContributeGoal(null)} />
      <ConfirmModal
        open={!!deleteTarget}
        title={t("goals.deleteGoalTitle")}
        message={t("goals.deleteGoalMessage", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("goals.delete")}
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={closeDeleteModal}
      />
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        triggeredBy="goals"
      />
    </div>
  );
}
