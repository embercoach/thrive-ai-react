import { useState, useEffect, useRef } from 'react';
import { IconX, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { openPaddleCheckout, isPaddleConfigured, fetchPriceLabels } from '@/lib/paddle';
import { useAuth } from '@/hooks/useAuth';
import { useAppData } from '@/hooks/useAppData';
import { useT } from '@/hooks/useI18n';

const MONTHLY_PRICE_ID = import.meta.env.VITE_PADDLE_PRICE_MONTHLY as string;
const ANNUAL_PRICE_ID = import.meta.env.VITE_PADDLE_PRICE_ANNUAL as string;

type BillingCycle = 'monthly' | 'annual';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  triggeredBy?: string;
}

export default function UpgradeModal({ open, onClose, triggeredBy }: UpgradeModalProps) {
  const t = useT();
  const { user } = useAuth();
  const { refetch } = useAppData();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(false);
  const [priceLabels, setPriceLabels] = useState<Record<string, string>>({});
  const [checkoutError, setCheckoutError] = useState(false);
  // `loading` alone can't guard against a fast double-click/double-tap:
  // setLoading(true) below doesn't take effect until the next render, and
  // handleUpgrade runs synchronously up to that point — two clicks close
  // enough together could both pass the `disabled` check and each open (or
  // attempt to open) their own Paddle checkout overlay. This ref is set
  // synchronously on the very first line, closing that window regardless of
  // render timing.
  const submittingRef = useRef(false);

  // Ask Paddle for the real, localised amounts once the modal is opened.
  // Hooks must run unconditionally, so this sits above the early return.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchPriceLabels([MONTHLY_PRICE_ID, ANNUAL_PRICE_ID]).then((labels) => {
      if (!cancelled) setPriceLabels(labels);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  // `triggeredBy` is a semantic code (not display text) so the surrounding
  // sentence stays fully translated in every language — an unrecognized
  // code (there shouldn't be one) falls back to showing it verbatim rather
  // than silently dropping the context.
  const TRIGGER_LABELS: Record<string, string> = {
    goals: t('upgradeModal.triggerGoals'),
    recurringTransactions: t('upgradeModal.triggerRecurringTransactions'),
    budgetCategories: t('upgradeModal.triggerBudgetCategories'),
    aiQuestions: t('upgradeModal.triggerAiQuestions'),
  };
  const triggerLabel = triggeredBy ? (TRIGGER_LABELS[triggeredBy] ?? triggeredBy) : undefined;

  const FEATURES = [
    t('upgradeModal.featureUnlimitedGoals'),
    t('upgradeModal.featureUnlimitedRecurring'),
    t('upgradeModal.featureUnlimitedBudgetCategories'),
    t('upgradeModal.featureUnlimitedAIQuestions'),
  ];

  const priceId = cycle === 'monthly' ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID;
  const monthlyLabel = priceLabels[MONTHLY_PRICE_ID];
  const annualLabel = priceLabels[ANNUAL_PRICE_ID];
  const selectedLabel = cycle === 'monthly' ? monthlyLabel : annualLabel;

  const handleUpgrade = async () => {
    if (!user || submittingRef.current) return;
    submittingRef.current = true;
    setCheckoutError(false);
    if (!isPaddleConfigured()) {
      console.error('Paddle is not configured — missing VITE_PADDLE_CLIENT_TOKEN.');
      setCheckoutError(true);
      submittingRef.current = false;
      return;
    }
    setLoading(true);
    const opened = await openPaddleCheckout(priceId, user.email ?? undefined, (event) => {
      if (event?.name === 'checkout.completed') {
        // The webhook that flips `is_pro` in Supabase runs server-side and
        // can lag a moment behind Paddle reporting the checkout as done —
        // without this, the app kept showing stale free-tier limits (and
        // could even bounce the user right back to this modal) until a full
        // page reload. Refetch immediately for the common fast case, and
        // again after a short delay to pick up a slower webhook.
        refetch();
        window.setTimeout(() => refetch(), 3000);
        setLoading(false);
        submittingRef.current = false;
        onClose();
      } else if (event?.name === 'checkout.closed') {
        setLoading(false);
        submittingRef.current = false;
      }
    });
    if (!opened) {
      // Paddle.js failed to load or the checkout-token fetch failed (ad-
      // blocker, network blip, expired session) — previously this only
      // logged to the console and left the spinner running until the
      // fallback timeout below silently cleared it with no explanation.
      setLoading(false);
      submittingRef.current = false;
      setCheckoutError(true);
      return;
    }
    // Fallback in case Paddle never fires an event (e.g. the overlay opened
    // but the user's still deciding) — keeps the button from being stuck
    // showing a spinner if events never arrive.
    window.setTimeout(() => {
      setLoading(false);
      submittingRef.current = false;
    }, 1500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-xl p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label={t('upgradeModal.closeAria')}
          className="absolute top-4 right-4 text-ink-muted hover:text-ink transition-colors"
        >
          <IconX size={20} />
        </button>

        <h2 className="font-serif text-2xl text-ink mb-1">{t('upgradeModal.title')}</h2>
        {triggerLabel ? (
          <p className="text-sm text-ink-secondary mb-4">
            {t('upgradeModal.triggeredMessage', { trigger: triggerLabel })}
          </p>
        ) : (
          <p className="text-sm text-ink-secondary mb-4">{t('upgradeModal.defaultMessage')}</p>
        )}

        <div className="flex rounded-xl bg-surface-sunken p-1 mb-5">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              cycle === 'monthly' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
            }`}
            onClick={() => setCycle('monthly')}
          >
            {t('upgradeModal.monthly')}
            {monthlyLabel && <span className="block text-xs font-normal opacity-80">{monthlyLabel}</span>}
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              cycle === 'annual' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
            }`}
            onClick={() => setCycle('annual')}
          >
            {t('upgradeModal.annual')} <span className="text-[#9C7440]">{t('upgradeModal.annualSave')}</span>
            {annualLabel && <span className="block text-xs font-normal opacity-80">{annualLabel}</span>}
          </button>
        </div>

        <ul className="space-y-2 mb-6">
          {FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-ink-secondary">
              <IconCheck size={16} className="text-[#9C7440] shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        <button
          onClick={handleUpgrade}
          disabled={loading || !priceId}
          className="w-full bg-[#9C7440] hover:bg-[#8a6537] disabled:opacity-60 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <IconLoader2 size={18} className="animate-spin" /> : null}
          {loading
            ? t('upgradeModal.openingCheckout')
            : selectedLabel
            ? t('upgradeModal.upgradeNowWithPrice', {
                price: selectedLabel,
                period: cycle === 'monthly' ? t('upgradeModal.periodMonth') : t('upgradeModal.periodYear'),
              })
            : t('upgradeModal.upgradeNow')}
        </button>

        {!priceId && (
          <p className="text-xs text-negative mt-2 text-center">{t('upgradeModal.missingPriceId')}</p>
        )}
        {checkoutError && (
          <p className="text-xs text-negative mt-2 text-center">{t('upgradeModal.checkoutUnavailable')}</p>
        )}
      </div>
    </div>
  );
}