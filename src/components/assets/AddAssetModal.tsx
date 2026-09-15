import { useState } from "react";
import { TrendingUp, Home, Car, Wallet, Package } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import * as api from "@/services/api";
import type { ManualAssetCategory } from "@/types";
import { useT } from "@/hooks/useI18n";

interface AddAssetModalProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES: ManualAssetCategory[] = ["investment", "property", "vehicle", "cash", "other"];

const CATEGORY_ICONS: Record<ManualAssetCategory, typeof TrendingUp> = {
  investment: TrendingUp,
  property: Home,
  vehicle: Car,
  cash: Wallet,
  other: Package,
};

export function AddAssetModal({ open, onClose }: AddAssetModalProps) {
  const t = useT();
  const { user } = useAuth();
  const { refetch } = useAppData();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ManualAssetCategory>("investment");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function categoryLabel(c: ManualAssetCategory): string {
    return t(`assets.category.${c}`);
  }

  function handleClose() {
    setName("");
    setCategory("investment");
    setValue("");
    setError("");
    onClose();
  }

  async function handleSave() {
    if (!user) return;
    const val = parseFloat(value);
    if (!name.trim() || !Number.isFinite(val)) {
      setError(t("assets.addModal.errorRequired"));
      return;
    }
    setSaving(true);
    setError("");
    const { error: dbError } = await api.addManualAsset({
      user_id: user.id,
      name: name.trim(),
      category,
      value: val,
    });
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    await refetch();
    handleClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={t("assets.addModal.title")} preventClose={saving}>
      {error && <p className="text-negative text-sm mb-3">{error}</p>}
      <Input
        label={t("assets.addModal.nameLabel")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("assets.addModal.namePlaceholder")}
        autoFocus
      />
      <div className="mb-3">
        <div className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
          {t("assets.addModal.categoryLabel")}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors ${
                  category === c
                    ? "bg-brand text-ink-on-brand border-brand"
                    : "bg-surface text-ink-secondary border-border-strong"
                }`}
              >
                <Icon size={15} />
                <span className="truncate w-full text-center">{categoryLabel(c)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <DecimalInput
        label={t("assets.addModal.valueLabel")}
        value={value}
        onChange={setValue}
        placeholder="10000"
      />
      <Button fullWidth onClick={handleSave} disabled={saving}>
        {saving ? t("assets.addModal.saving") : t("assets.addModal.submit")}
      </Button>
    </Modal>
  );
}
