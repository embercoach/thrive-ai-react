import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bell, BellOff, Clock, AlertTriangle, CircleCheck, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { useAlerts } from "@/hooks/useAlerts";
import { useT } from "@/hooks/useI18n";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/currency";
import { isPushSupported, getPushPermission, isPushSubscribed, subscribeToPush, unsubscribeFromPush, isPushErrorCode } from "@/lib/push";
import * as api from "@/services/api";

const DIGEST_FREQUENCIES: Array<"off" | "weekly" | "monthly"> = ["off", "weekly", "monthly"];

export function NotificationsPage() {
  const navigate = useNavigate();
  const t = useT();
  const { user } = useAuth();
  const { profile, recurring, budgets, transactions, currency, isPro, refetch } = useAppData();
  const alerts = useAlerts(recurring, budgets, transactions, isPro);

  const [checkingStatus, setCheckingStatus] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [pushError, setPushError] = useState("");

  const [savingDigest, setSavingDigest] = useState(false);
  const [digestError, setDigestError] = useState("");
  const digestFrequency = profile?.digest_frequency || "off";

  async function handleSetDigestFrequency(freq: "off" | "weekly" | "monthly") {
    if (!user || freq === digestFrequency) return;
    setSavingDigest(true);
    setDigestError("");
    const { error } = await api.upsertProfile({ id: user.id, digest_frequency: freq });
    setSavingDigest(false);
    if (error) {
      setDigestError(t("notifications.digestError"));
      return;
    }
    await refetch();
  }

  const supported = isPushSupported();
  const permission = getPushPermission();

  useEffect(() => {
    let cancelled = false;
    isPushSubscribed().then((result) => {
      if (!cancelled) {
        setSubscribed(result);
        setCheckingStatus(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle() {
    if (!user) return;
    setToggling(true);
    setPushError("");

    const { error } = subscribed ? await unsubscribeFromPush(user.id) : await subscribeToPush(user.id);
    setToggling(false);

    if (error) {
      // A known code (e.g. "unsupported") gets a translated message; any
      // other string is a raw Supabase/browser error message, already
      // language-agnostic text, and is shown as-is.
      setPushError(isPushErrorCode(error) ? t(`notifications.push.${error}`) : error);
      return;
    }
    setSubscribed(!subscribed);
  }

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label={t("notifications.backAria")}
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">{t("notifications.title")}</h1>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-1">
          {subscribed ? <Bell size={16} className="text-brand" /> : <BellOff size={16} className="text-ink-secondary" />}
          <h2 className="text-sm font-bold text-ink">{t("notifications.pushTitle")}</h2>
        </div>

        {!supported ? (
          <p className="text-xs text-ink-secondary mt-2">
            {t("notifications.notSupported")}
          </p>
        ) : permission === "denied" ? (
          <p className="text-xs text-ink-secondary mt-2">
            {t("notifications.denied")}
          </p>
        ) : (
          <>
            <p className="text-xs text-ink-secondary mt-2 mb-3">
              {t("notifications.description")}
            </p>
            {pushError && (
              <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
                {pushError}
              </p>
            )}
            <Button size="sm" variant={subscribed ? "outline" : "primary"} onClick={handleToggle} disabled={toggling || checkingStatus}>
              {toggling
                ? "…"
                : checkingStatus
                  ? t("notifications.checking")
                  : subscribed
                    ? t("notifications.turnOff")
                    : t("notifications.turnOn")}
            </Button>
          </>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-1">
          <Mail size={16} className="text-ink-secondary" />
          <h2 className="text-sm font-bold text-ink">{t("notifications.digestTitle")}</h2>
        </div>
        <p className="text-xs text-ink-secondary mt-2 mb-3">{t("notifications.digestDescription")}</p>
        {digestError && (
          <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
            {digestError}
          </p>
        )}
        <div className="flex gap-1.5">
          {DIGEST_FREQUENCIES.map((freq) => (
            <button
              key={freq}
              type="button"
              onClick={() => handleSetDigestFrequency(freq)}
              disabled={savingDigest}
              className={`flex-1 py-2 px-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors disabled:opacity-60 ${
                digestFrequency === freq
                  ? "bg-brand text-ink-on-brand border-brand"
                  : "bg-surface text-ink-secondary border-border-strong"
              }`}
            >
              {t(`notifications.digestFrequency.${freq}`)}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-bold text-ink mb-2">{t("notifications.currentAlerts")}</h2>
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 py-2">
            <CircleCheck size={16} className="text-brand flex-shrink-0" />
            <p className="text-xs text-ink-secondary">{t("notifications.allCaughtUp")}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {alerts.map((alert, i) => {
              const isBill = alert.kind === "bill_due";
              const Icon = isBill ? Clock : AlertTriangle;
              const text = isBill
                ? alert.daysUntil === 0
                  ? t("notifications.billDueToday", { name: alert.name, amount: formatMoney(alert.amount, currency) })
                  : alert.daysUntil === 1
                    ? t("notifications.billDueTomorrow", { name: alert.name, amount: formatMoney(alert.amount, currency) })
                    : t("notifications.billDueInDays", { name: alert.name, days: alert.daysUntil, amount: formatMoney(alert.amount, currency) })
                : t("notifications.overBudget", { category: alert.category, amount: formatMoney(alert.spent - alert.budget, currency) });
              return (
                <div key={i} className="flex items-start gap-2.5 py-2.5 border-b border-border last:border-0">
                  <Icon size={15} className={`flex-shrink-0 mt-0.5 ${isBill ? "text-warning" : "text-negative"}`} />
                  <p className="text-xs text-ink leading-relaxed">{text}</p>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
