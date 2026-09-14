import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, TrendingUp, Home, Car, Wallet, Package } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useT } from "@/hooks/useI18n";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AddAssetModal } from "@/components/assets/AddAssetModal";
import { formatMoneySigned } from "@/lib/currency";
import * as api from "@/services/api";
import type { ManualAsset, ManualAssetCategory } from "@/types";

const CATEGORY_ICONS: Record<ManualAssetCategory, typeof TrendingUp> = {
  investment: TrendingUp,
  property: Home,
  vehicle: Car,
  cash: Wallet,
  other: Package,
};

export function AssetsPage() {
  const navigate = useNavigate();
  const t = useT();
  const { user } = useAuth();
  const { manualAssets, currency, refetch } = useAppData();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManualAsset | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const total = manualAssets.reduce((a, m) => a + Number(m.value), 0);

  function closeDeleteModal() {
    setDeleteTarget(null);
    setDeleteError("");
  }

  async function handleDelete() {
    if (!deleteTarget || !user) return;
    setDeleting(true);
    setDeleteError("");
    const { error } = await api.deleteManualAsset(user.id, deleteTarget.id);
    setDeleting(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    closeDeleteModal();
    await refetch();
  }

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label={t("assets.backAria")}
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">{t("assets.title")}</h1>
      </div>

      <Card>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
          {t("assets.totalLabel")}
        </div>
        <div className="text-2xl font-bold text-ink">{formatMoneySigned(total, currency)}</div>
        <p className="text-[11px] text-ink-muted mt-1.5">{t("assets.totalHelp")}</p>
      </Card>

      {manualAssets.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-secondary text-center mb-3">{t("assets.noneMessage")}</p>
          <button
            onClick={() => setAddOpen(true)}
            className="mx-auto flex items-center gap-1.5 py-2 px-4 rounded-xl bg-brand/12 border border-brand/30 text-brand text-xs font-bold cursor-pointer"
          >
            <Plus size={14} /> {t("assets.addFirst")}
          </button>
        </Card>
      ) : (
        <Card padding="lg">
          {manualAssets.map((a) => {
            const Icon = CATEGORY_ICONS[a.category] ?? Package;
            return (
              <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <div className="w-9 h-9 rounded-full bg-surface-sunken flex items-center justify-center flex-shrink-0">
                  <Icon size={15} className="text-ink-secondary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink truncate">{a.name}</div>
                  <div className="text-[11px] text-ink-muted">{t(`assets.category.${a.category}`)}</div>
                </div>
                <div className="text-sm font-semibold text-ink flex-shrink-0">
                  {formatMoneySigned(a.value, currency)}
                </div>
                <button
                  onClick={() => setDeleteTarget(a)}
                  aria-label={t("assets.deleteAria", { name: a.name })}
                  className="text-ink-muted hover:text-negative cursor-pointer p-1 flex-shrink-0"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </Card>
      )}

      {manualAssets.length > 0 && (
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> {t("assets.addAnother")}
        </Button>
      )}

      <p className="text-[11px] text-ink-muted leading-relaxed">{t("assets.footerNote")}</p>

      <AddAssetModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ConfirmModal
        open={!!deleteTarget}
        title={t("assets.deleteModalTitle")}
        message={t("assets.deleteModalMessage", { name: deleteTarget?.name ?? "" })}
        confirmLabel={t("assets.delete")}
        loading={deleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={closeDeleteModal}
      />
    </div>
  );
}
