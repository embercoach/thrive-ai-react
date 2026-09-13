import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, CircleCheck } from "lucide-react";
import { supabase } from "../services/supabase";
import { useAuth } from "../hooks/useAuth";
import { useT } from "@/hooks/useI18n";

export function HelpFeedbackPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const t = useT();

  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError(t("misc.help.errorEmpty"));
      return;
    }

    setSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from("feedback").insert({
      user_id: user?.id ?? null,
      email: user?.email ?? null,
      message: trimmed,
    });

    setSubmitting(false);

    if (insertError) {
      setError(t("misc.help.errorSubmit"));
      return;
    }

    setSubmitted(true);
    setMessage("");
  };

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label={t("misc.help.backAria")}
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">{t("misc.help.title")}</h1>
      </div>

      {submitted ? (
        <div className="flex flex-col items-center text-center pt-10 pb-6 gap-3">
          <CircleCheck size={44} className="text-brand" />
          <h2 className="text-lg font-bold text-ink">{t("misc.help.thanksTitle")}</h2>
          <p className="text-sm text-ink-secondary max-w-xs leading-relaxed">{t("misc.help.thanksBody")}</p>
          <button
            onClick={() => setSubmitted(false)}
            className="mt-1 text-sm font-semibold text-brand cursor-pointer"
          >
            {t("misc.help.sendAnother")}
          </button>
        </div>
      ) : (
        <>
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-sm text-ink-secondary leading-relaxed">{t("misc.help.intro")}</p>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t("misc.help.placeholder")}
            aria-label={t("misc.help.messageAria")}
            rows={6}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
          />

          {error && <p className="text-sm text-negative">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full rounded-2xl bg-brand text-ink-on-brand font-semibold py-3.5 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? t("misc.help.sending") : t("misc.help.submit")}
          </button>
        </>
      )}
    </div>
  );
}
