import { useState, useEffect } from "react";
import {
  Landmark,
  LogOut,
  Crown,
  Bell,
  Shield,
  ShieldCheck,
  FileText,
  Palette,
  HelpCircle,
  Info,
  ChevronRight,
  Check,
  Sun,
  Moon,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useTheme } from "@/hooks/useTheme";
import { useI18n, LANGUAGES } from "@/hooks/useI18n";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DecimalInput } from "@/components/ui/DecimalInput";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CURRENCIES } from "@/lib/currency";
import { supabase } from "@/services/supabase";
import * as api from "@/services/api";
import type { CurrencyCode } from "@/types";
import UpgradeModal from "@/components/profile/UpgradeModal";

function NavRow({ icon: Icon, label, onClick }: { icon: typeof Bell; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 border-b border-border last:border-0 cursor-pointer text-left"
    >
      <Icon size={17} className="text-ink-secondary flex-shrink-0" />
      <span className="flex-1 text-sm text-ink">{label}</span>
      <ChevronRight size={15} className="text-ink-muted" />
    </button>
  );
}

function AppearanceRow({ label, lightAria, darkAria }: { label: string; lightAria: string; darkAria: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      <Palette size={17} className="text-ink-secondary flex-shrink-0" />
      <span className="flex-1 text-sm text-ink">{label}</span>
      <div className="flex items-center gap-1 bg-surface-sunken rounded-lg p-0.5">
        <button
          onClick={() => setTheme("light")}
          aria-label={lightAria}
          className={`flex items-center justify-center w-7 h-7 rounded-md cursor-pointer transition-colors ${
            theme === "light" ? "bg-brand text-ink-on-brand" : "text-ink-muted"
          }`}
        >
          <Sun size={14} />
        </button>
        <button
          onClick={() => setTheme("dark")}
          aria-label={darkAria}
          className={`flex items-center justify-center w-7 h-7 rounded-md cursor-pointer transition-colors ${
            theme === "dark" ? "bg-brand text-ink-on-brand" : "text-ink-muted"
          }`}
        >
          <Moon size={14} />
        </button>
      </div>
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isPro, refetch } = useAppData();
  const { language, setLanguage, t } = useI18n();
  const [income, setIncome] = useState(String(profile?.monthly_income ?? ""));
  const [savingIncome, setSavingIncome] = useState(false);
  const [incomeError, setIncomeError] = useState("");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [currencyError, setCurrencyError] = useState("");
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [savingLanguage, setSavingLanguage] = useState(false);
  const [languageError, setLanguageError] = useState("");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  // `profile` is null on the first render while useAppData fetches, so the
  // useState initialiser above always ran with an empty value and never
  // caught up. That left the field blank even when an income WAS saved —
  // and because an empty field saves as `parseFloat("") || 0`, the next
  // Save silently wiped the stored income and broke every savings-rate
  // insight that depends on it. Re-sync whenever the stored value changes.
  useEffect(() => {
    setIncome(profile?.monthly_income ? String(profile.monthly_income) : "");
  }, [profile?.monthly_income]);

  const initial = (profile?.name || profile?.email || "?").charAt(0).toUpperCase();

  async function handleSaveIncome() {
    if (!user) return;
    setSavingIncome(true);
    setIncomeError("");
    // Errors here were previously silent: the button would just stop
    // showing "…" as if the save had gone through, while the old value
    // stayed in the database and every savings-rate insight kept using it.
    const { error } = await api.upsertProfile({ id: user.id, monthly_income: parseFloat(income) || 0 });
    setSavingIncome(false);
    if (error) {
      setIncomeError(error.message);
      return;
    }
    await refetch();
  }

  async function handleSelectCurrency(code: CurrencyCode) {
    if (!user) return;
    setSavingCurrency(true);
    setCurrencyError("");
    const { error } = await api.upsertProfile({ id: user.id, currency: code });
    setSavingCurrency(false);
    if (error) {
      setCurrencyError(error.message);
      return;
    }
    setShowCurrencyPicker(false);
    await refetch();
  }

  async function handleSelectLanguage(code: string) {
    // Switches the display language immediately regardless of whether the
    // account save succeeds — a slow or failed network write shouldn't
    // block someone from reading the rest of the app in their language.
    setLanguage(code);
    setShowLanguagePicker(false);
    if (!user) return;
    setSavingLanguage(true);
    setLanguageError("");
    const { error } = await api.upsertProfile({ id: user.id, language: code });
    setSavingLanguage(false);
    if (error) {
      setLanguageError(error.message);
      return;
    }
    await refetch();
  }

  async function handleSignOut() {
    setSigningOut(true);
    setSignOutError("");
    // signOut() resolves with { error } rather than throwing — left
    // unchecked (as this was), an expired session token or a transient
    // network error would leave `signingOut` true forever with the confirm
    // modal's button stuck disabled and no explanation, the same bug fixed
    // in MfaChallengePage's sign-out button this session.
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSignOutError(t("profile.signOutError"));
      setSigningOut(false);
      return;
    }
    // No need to clear signingOut/confirmingSignOut on success — a
    // successful sign-out unmounts this whole page via the auth gate.
  }

  const currentLanguage = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center text-ink-on-brand font-extrabold text-xl flex-shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold text-ink truncate">{profile?.name || t("profile.yourAccount")}</div>
          <div className="text-sm text-ink-secondary truncate">{profile?.email}</div>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={17} className={isPro ? "text-brand" : "text-ink-muted"} />
            <span className="text-sm font-bold text-ink">{isPro ? t("profile.proPlan") : t("profile.freePlan")}</span>
          </div>
          {!isPro && (
            <Button size="sm" variant="primary" onClick={() => setShowUpgradeModal(true)}>
              {t("profile.upgrade")}
            </Button>
          )}
        </div>
        {!isPro && (
          <p className="text-xs text-ink-muted mt-2">
            {t("profile.freePlanDescription")}
          </p>
        )}
      </Card>

      <Card>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">{t("profile.monthlyIncome")}</div>
        <div className="flex gap-2">
          <DecimalInput
            value={income}
            onChange={setIncome}
            placeholder="0"
            className="!mb-0 flex-1"
            disabled={savingIncome}
          />
          <Button size="sm" onClick={handleSaveIncome} disabled={savingIncome}>
            {savingIncome ? "…" : t("profile.save")}
          </Button>
        </div>
        {incomeError ? (
          <p className="text-[11px] text-negative mt-1.5">{incomeError}</p>
        ) : (
          <p className="text-[11px] text-ink-muted mt-1.5">{t("profile.savingsRateHelp")}</p>
        )}
      </Card>

      <Card padding="none">
        <button
          onClick={() => setShowCurrencyPicker((s) => !s)}
          className="w-full flex items-center justify-between p-4 cursor-pointer"
        >
          <span className="text-sm font-semibold text-ink">{t("profile.currency")}</span>
          <span className="text-sm text-ink-secondary flex items-center gap-1">
            {CURRENCIES[(profile?.currency as CurrencyCode) || "USD"].label}
            <ChevronRight size={15} className={showCurrencyPicker ? "rotate-90 transition-transform" : "transition-transform"} />
          </span>
        </button>
        {currencyError && (
          <p className="text-[11px] text-negative px-4 pb-3">{currencyError}</p>
        )}
        {showCurrencyPicker && (
          <div className="border-t border-border px-2 pb-2">
            {(Object.keys(CURRENCIES) as CurrencyCode[]).map((code) => (
              <button
                key={code}
                onClick={() => handleSelectCurrency(code)}
                disabled={savingCurrency}
                className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg hover:bg-surface-sunken cursor-pointer text-left"
              >
                <span className="text-sm text-ink">{CURRENCIES[code].label}</span>
                {profile?.currency === code && <Check size={15} className="text-brand" />}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card padding="none">
        <button
          onClick={() => setShowLanguagePicker((s) => !s)}
          className="w-full flex items-center justify-between p-4 cursor-pointer"
        >
          <span className="text-sm font-semibold text-ink">{t("profile.language")}</span>
          <span className="text-sm text-ink-secondary flex items-center gap-1">
            {currentLanguage.nativeLabel}
            <ChevronRight size={15} className={showLanguagePicker ? "rotate-90 transition-transform" : "transition-transform"} />
          </span>
        </button>
        {languageError && (
          <p className="text-[11px] text-negative px-4 pb-3">{languageError}</p>
        )}
        {showLanguagePicker && (
          <div className="border-t border-border px-2 pb-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleSelectLanguage(lang.code)}
                disabled={savingLanguage}
                className="w-full flex items-center justify-between px-2.5 py-2.5 rounded-lg hover:bg-surface-sunken cursor-pointer text-left"
              >
                <span className="text-sm text-ink">{lang.nativeLabel}</span>
                {language === lang.code && <Check size={15} className="text-brand" />}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card padding="lg">
        <NavRow icon={Landmark} label={t("profile.connectedBanks")} onClick={() => navigate("/connected-banks")} />
        <NavRow icon={TrendingUp} label={t("profile.assets")} onClick={() => navigate("/assets")} />
        <NavRow icon={Bell} label={t("profile.notifications")} onClick={() => navigate("/notifications")} />
        <NavRow icon={Shield} label={t("profile.security")} onClick={() => navigate("/security")} />
        <AppearanceRow label={t("profile.appearance")} lightAria={t("profile.lightModeAria")} darkAria={t("profile.darkModeAria")} />
      </Card>

      <Card padding="lg">
        <NavRow icon={HelpCircle} label={t("profile.helpFeedback")} onClick={() => navigate("/help")} />
        <NavRow icon={Info} label={t("profile.about")} onClick={() => navigate("/about")} />
        <NavRow icon={ShieldCheck} label={t("profile.privacyPolicy")} onClick={() => navigate("/privacy")} />
        <NavRow icon={FileText} label={t("profile.termsOfService")} onClick={() => navigate("/terms")} />
      </Card>

      <Button variant="danger" fullWidth onClick={() => setConfirmingSignOut(true)}>
        <LogOut size={15} /> {t("profile.signOut")}
      </Button>

      <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
        {t("common.educational")}
      </p>

      <ConfirmModal
        open={confirmingSignOut}
        title={t("profile.signOutConfirmTitle")}
        message={t("profile.signOutConfirmMessage")}
        confirmLabel={t("profile.signOut")}
        loading={signingOut}
        error={signOutError}
        onConfirm={handleSignOut}
        onCancel={() => setConfirmingSignOut(false)}
      />
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}
