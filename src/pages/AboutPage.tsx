import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/hooks/useI18n";

const APP_VERSION = "1.0.0";

export function AboutPage() {
  const navigate = useNavigate();
  const t = useT();

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label={t("misc.about.backAria")}
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">{t("misc.about.title")}</h1>
      </div>

      <div className="flex flex-col items-center pt-4 pb-2">
        <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center text-ink-on-brand font-extrabold text-2xl mb-3">
          T
        </div>
        <h2 className="text-lg font-bold text-ink">{t("misc.about.appName")}</h2>
        <p className="text-xs text-ink-muted mt-1">{t("misc.about.version", { version: APP_VERSION })}</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4">
        <p className="text-sm text-ink-secondary leading-relaxed">{t("misc.about.description")}</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
          {t("misc.about.important")}
        </p>
        <p className="text-sm text-ink-secondary leading-relaxed">{t("misc.about.disclaimer")}</p>
      </div>

      <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
        {t("misc.about.madeWithCare")}
      </p>
    </div>
  );
}
