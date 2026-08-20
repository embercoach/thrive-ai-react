import { useState, useEffect } from 'react';
import { IconX, IconCheck, IconLoader2 } from '@tabler/icons-react';
import { openPaddleCheckout, isPaddleConfigured, fetchPriceLabels } from '@/lib/paddle';
import { useAuth } from '@/hooks/useAuth';

const MONTHLY_PRICE_ID = import.meta.env.VITE_PADDLE_PRICE_MONTHLY as string;
const ANNUAL_PRICE_ID = import.meta.env.VITE_PADDLE_PRICE_ANNUAL as string;

type BillingCycle = 'monthly' | 'annual';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  triggeredBy?: string;
}

const FEATURES = [
  'Unlimited goals',
  'Unlimited recurring transactions',
  'Unlimited budget categories',
  'Unlimited AI Advisor questions',
];

export default function UpgradeModal({ open, onClose, triggeredBy }: UpgradeModalProps) {
  const { user } = useAuth();
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [loading, setLoading] = useState(false);
  const [priceLabels, setPriceLabels] = useState<Record<string, string>>({});

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

  const priceId = cycle === 'monthly' ? MONTHLY_PRICE_ID : ANNUAL_PRICE_ID;
  const monthlyLabel = priceLabels[MONTHLY_PRICE_ID];
  const annualLabel = priceLabels[ANNUAL_PRICE_ID];
  const selectedLabel = cycle === 'monthly' ? monthlyLabel : annualLabel;

  const handleUpgrade = () => {
    if (!user) return;
    if (!isPaddleConfigured()) {
      console.error('Paddle is not configured — missing VITE_PADDLE_CLIENT_TOKEN.');
      return;
    }
    setLoading(true);
    openPaddleCheckout(priceId, user.id, user.email ?? undefined);
    window.setTimeout(() => setLoading(false), 1500);
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
          aria-label="Close"
          className="absolute top-4 right-4 text-ink-muted hover:text-ink transition-colors"
        >
          <IconX size={20} />
        </button>

        <h2 className="font-serif text-2xl text-ink mb-1">Upgrade to Thrive Pro</h2>
        {triggeredBy ? (
          <p className="text-sm text-ink-secondary mb-4">
            You've hit the free-tier limit for {triggeredBy}. Upgrade for unlimited access.
          </p>
        ) : (
          <p className="text-sm text-ink-secondary mb-4">Unlock the full Thrive AI experience.</p>
        )}

        <div className="flex rounded-xl bg-surface-sunken p-1 mb-5">
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              cycle === 'monthly' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
            }`}
            onClick={() => setCycle('monthly')}
          >
            Monthly
            {monthlyLabel && <span className="block text-xs font-normal opacity-80">{monthlyLabel}</span>}
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              cycle === 'annual' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted'
            }`}
            onClick={() => setCycle('annual')}
          >
            Annual <span className="text-[#9C7440]">· save</span>
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
            ? 'Opening checkout…'
            : selectedLabel
            ? `Upgrade now — ${selectedLabel}/${cycle === 'monthly' ? 'month' : 'year'}`
            : 'Upgrade now'}
        </button>

        {!priceId && (
          <p className="text-xs text-negative mt-2 text-center">
            Missing Paddle price ID env var — check VITE_PADDLE_PRICE_MONTHLY / VITE_PADDLE_PRICE_ANNUAL.
          </p>
        )}
      </div>
    </div>
  );
}