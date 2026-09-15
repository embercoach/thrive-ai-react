import { useState } from "react";
import { Check, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useT } from "@/hooks/useI18n";
import { Input } from "@/components/ui/Input";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { Button } from "@/components/ui/Button";
import { CURRENCIES } from "@/lib/currency";
import * as api from "@/services/api";
import type { CurrencyCode } from "@/types";

/**
 * First run. Four short steps, and every one can be skipped — the only thing
 * that must be true at the end is that `onboarded` is set, so we never ask
 * again. Anything the user skips stays empty and is filled in later from the
 * normal screens, which all already handle empty state.
 *
 * Deliberately not a tour: nobody reads a tour. We ask for the few values that
 * make Home show something real on first load, and get out of the way.
 */

const STEPS = ["name", "currency", "income", "goal"] as const;
type Step = (typeof STEPS)[number];

export function OnboardingPage() {
  const t = useT();
  const { user } = useAuth();
  const { profile, refetch } = useAppData();

  const [stepIndex, setStepIndex] = useState(0);
  const step: Step = STEPS[stepIndex];

  // Seed the name from whatever we already know, so the common case is a
  // single tap rather than typing.
  const [name, setName] = useState(profile?.name ?? user?.email?.split("@")[0] ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>((profile?.currency as CurrencyCode) ?? "USD");
  const [income, setIncome] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function next() {
    setError("");
    if (stepIndex < STEPS.length - 1) setStepIndex((i) => i + 1);
    else void finish();
  }
  function back() {
    setError("");
    setStepIndex((i) => Math.max(0, i - 1));
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    setError("");

    const parsedIncome = parseFloat(income);
    const { error: profErr } = await api.upsertProfile({
      id: user.id,
      name: name.trim() || undefined,
      currency,
      ...(Number.isFinite(parsedIncome) && parsedIncome > 0 ? { monthly_income: parsedIncome } : {}),
      onboarded: true,
    });

    if (profErr) {
      setSaving(false);
      setError(profErr.message);
      return;
    }

    // The goal is optional and secondary — if it fails we still let the user
    // into the app rather than trapping them on the last step of onboarding.
    const target = parseFloat(goalTarget);
    if (goalName.trim() && Number.isFinite(target) && target > 0) {
      await api.addGoal({
        user_id: user.id,
        name: goalName.trim(),
        target: Math.abs(target),
        current: 0,
        deadline: null,
      });
    }

    await refetch();
    setSaving(false);
  }

  const symbol = CURRENCIES[currency].symbol;

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden flex items-center justify-center px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 w-80 h-80 rounded-full opacity-[0.15] blur-3xl"
        style={{ background: "var(--color-brand)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-24 w-96 h-96 rounded-full opacity-[0.10] blur-3xl"
        style={{ background: "var(--color-brand)" }}
      />

      <div className="w-full max-w-[380px] relative z-10">
        <div className="bg-surface border border-border rounded-3xl p-7 shadow-xl shadow-black/5">
          {/* progress */}
          <div className="flex items-center gap-2 mb-6">
            {stepIndex > 0 ? (
              <button
                onClick={back}
                aria-label={t("onboarding.backAria")}
                className="text-ink-muted hover:text-ink transition-colors -ml-1"
              >
                <ChevronLeft size={20} />
              </button>
            ) : (
              <span className="w-[19px]" />
            )}
            <div className="flex-1 flex gap-1.5">
              {STEPS.map((s, i) => (
                <span
                  key={s}
                  className="h-1 flex-1 rounded-full transition-colors"
                  style={{ background: i <= stepIndex ? "var(--color-brand)" : "var(--color-border-strong)" }}
                />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-ink-muted tabular-nums">
              {t("onboarding.stepCounter", { current: stepIndex + 1, total: STEPS.length })}
            </span>
          </div>

          {error && (
            <p className="text-negative text-sm mb-4 text-center bg-negative/5 border border-negative/20 rounded-xl py-2 px-3">
              {error}
            </p>
          )}

          {step === "name" && (
            <>
              <h1 className="text-xl font-bold text-ink mb-1.5">{t("onboarding.nameTitle")}</h1>
              <p className="text-ink-secondary text-sm mb-6">
                {t("onboarding.nameSubtitle")}
              </p>
              <Input
                label={t("onboarding.nameLabel")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("onboarding.namePlaceholder")}
                autoFocus
              />
            </>
          )}

          {step === "currency" && (
            <>
              <h1 className="text-xl font-bold text-ink mb-1.5">{t("onboarding.currencyTitle")}</h1>
              <p className="text-ink-secondary text-sm mb-5">
                {t("onboarding.currencySubtitle")}
              </p>
              <div className="max-h-[260px] overflow-y-auto -mx-1 px-1">
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
                  <button
                    key={code}
                    onClick={() => setCurrency(code)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-surface-sunken cursor-pointer text-left transition-colors"
                  >
                    <span className="text-sm text-ink">
                      <span className="inline-block w-7 font-bold text-ink-secondary">
                        {CURRENCIES[code].symbol}
                      </span>
                      {CURRENCIES[code].label}
                    </span>
                    {currency === code && <Check size={16} className="text-brand" />}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === "income" && (
            <>
              <h1 className="text-xl font-bold text-ink mb-1.5">{t("onboarding.incomeTitle")}</h1>
              <p className="text-ink-secondary text-sm mb-6">
                {t("onboarding.incomeSubtitle")}
              </p>
              <DecimalInput
                label={t("onboarding.incomeLabel", { symbol })}
                value={income}
                onChange={setIncome}
                placeholder="0"
                autoFocus
              />
            </>
          )}

          {step === "goal" && (
            <>
              <h1 className="text-xl font-bold text-ink mb-1.5">{t("onboarding.goalTitle")}</h1>
              <p className="text-ink-secondary text-sm mb-6">
                {t("onboarding.goalSubtitle")}
              </p>
              <Input
                label={t("onboarding.goalLabel")}
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                placeholder={t("onboarding.goalPlaceholder")}
                autoFocus
              />
              <DecimalInput
                label={t("onboarding.targetLabel", { symbol })}
                value={goalTarget}
                onChange={setGoalTarget}
                placeholder="0"
              />
            </>
          )}

          <Button fullWidth onClick={next} disabled={saving} className="mt-4">
            {saving
              ? t("onboarding.settingUp")
              : stepIndex === STEPS.length - 1
                ? t("onboarding.finish")
                : t("onboarding.continue")}
          </Button>

          {step !== "name" && (
            <button
              type="button"
              onClick={next}
              disabled={saving}
              className="w-full text-center text-sm font-semibold text-ink-muted hover:text-ink transition-colors mt-3.5 disabled:opacity-50"
            >
              {t("onboarding.skip")}
            </button>
          )}
        </div>

        <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide mt-5">
          {t("common.educational")}
        </p>
      </div>
    </div>
  );
}
