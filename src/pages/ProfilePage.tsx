import { useState } from "react";
import {
  User,
  LogOut,
  Crown,
  Bell,
  Shield,
  Palette,
  Globe,
  HelpCircle,
  Info,
  ChevronRight,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAppData } from "@/hooks/useAppData";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CURRENCIES } from "@/lib/currency";
import { supabase } from "@/services/supabase";
import * as api from "@/services/api";
import type { CurrencyCode } from "@/types";
import UpgradeModal from "@/components/profile/UpgradeModal";

function ComingSoonRow({ icon: Icon, label }: { icon: typeof Bell; label: string }) {
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0 opacity-50 cursor-not-allowed">
      <Icon size={17} className="text-ink-muted flex-shrink-0" />
      <span className="flex-1 text-sm text-ink-secondary">{label}</span>
      <span className="text-[9px] font-bold uppercase tracking-wide text-ink-muted bg-surface-sunken px-1.5 py-0.5 rounded">
        Soon
      </span>
    </div>
  );
}

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

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isPro, refetch } = useAppData();
  const [income, setIncome] = useState(String(profile?.monthly_income ?? ""));
  const [savingIncome, setSavingIncome] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [savingCurrency, setSavingCurrency] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const initial = (profile?.name || profile?.email || "?").charAt(0).toUpperCase();

  async function handleSaveIncome() {
    if (!user) return;
    setSavingIncome(true);
    await api.upsertProfile({ id: user.id, monthly_income: parseFloat(income) || 0 });
    setSavingIncome(false);
    await refetch();
  }

  async function handleSelectCurrency(code: CurrencyCode) {
    if (!user) return;
    setSavingCurrency(true);
    await api.upsertProfile({ id: user.id, currency: code });
    setSavingCurrency(false);
    setShowCurrencyPicker(false);
    await refetch();
  }

  async function handleSignOut() {
    if (!confirm("Sign out of Thrive AI?")) return;
    await supabase.auth.signOut();
  }

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center text-ink-on-brand font-extrabold text-xl flex-shrink-0">
          {initial}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold text-ink truncate">{profile?.name || "Your Account"}</div>
          <div className="text-sm text-ink-secondary truncate">{profile?.email}</div>
        </div>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={17} className={isPro ? "text-brand" : "text-ink-muted"} />
            <span className="text-sm font-bold text-ink">{isPro ? "Pro Plan" : "Free Plan"}</span>
          </div>
          {!isPro && (
            <Button size="sm" variant="primary" onClick={() => setShowUpgradeModal(true)}>
              Upgrade
            </Button>
          )}
        </div>
        {!isPro && (
          <p className="text-xs text-ink-muted mt-2">
            Free plan includes 2 goals and 3 AI questions per month. Upgrade for unlimited access.
          </p>
        )}
      </Card>

      <Card>
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">Monthly Income</div>
        <div className="flex gap-2">
          <Input
            type="number"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="0"
            className="!mb-0 flex-1"
          />
          <Button size="sm" onClick={handleSaveIncome} disabled={savingIncome}>
            {savingIncome ? "…" : "Save"}
          </Button>
        </div>
        <p className="text-[11px] text-ink-muted mt-1.5">Used for your savings-rate insights on Home.</p>
      </Card>

      <Card padding="none">
        <button
          onClick={() => setShowCurrencyPicker((s) => !s)}
          className="w-full flex items-center justify-between p-4 cursor-pointer"
        >
          <span className="text-sm font-semibold text-ink">Currency</span>
          <span className="text-sm text-ink-secondary flex items-center gap-1">
            {CURRENCIES[(profile?.currency as CurrencyCode) || "USD"].label}
            <ChevronRight size={15} className={showCurrencyPicker ? "rotate-90 transition-transform" : "transition-transform"} />
          </span>
        </button>
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

      <Card padding="lg">
        <ComingSoonRow icon={User} label="Connected Banks" />
        <ComingSoonRow icon={Bell} label="Notifications" />
        <ComingSoonRow icon={Shield} label="Security" />
        <ComingSoonRow icon={Palette} label="Appearance" />
        <ComingSoonRow icon={Globe} label="Language" />
      </Card>

      <Card padding="lg">
        <ComingSoonRow icon={HelpCircle} label="Help & Feedback" />
        <NavRow icon={Info} label="About Thrive AI" onClick={() => navigate("/about")} />
      </Card>

      <Button variant="danger" fullWidth onClick={handleSignOut}>
        <LogOut size={15} /> Sign Out
      </Button>

      <p className="text-center text-[10.5px] text-ink-muted uppercase tracking-wide pt-1 pb-2">
        Educational purposes only · Not financial advice
      </p>

      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}