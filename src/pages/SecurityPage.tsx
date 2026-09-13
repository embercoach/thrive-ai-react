import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, KeyRound, ShieldCheck, ShieldPlus } from "lucide-react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface EnrollingFactor {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function SecurityPage() {
  const navigate = useNavigate();

  // --- Change password ---
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

  // --- Two-factor authentication ---
  const [loadingFactors, setLoadingFactors] = useState(true);
  const [activeFactor, setActiveFactor] = useState<Factor | null>(null);
  const [startingEnroll, setStartingEnroll] = useState(false);
  const [startError, setStartError] = useState("");
  const [enrollment, setEnrollment] = useState<EnrollingFactor | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState("");

  const loadFactors = useCallback(async () => {
    setLoadingFactors(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setActiveFactor(data?.totp?.find((f) => f.status === "verified") ?? null);
    setLoadingFactors(false);
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSaved(false);

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Those passwords don't match.");
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaved(true);
  }

  async function handleStartEnroll() {
    setStartError("");
    setStartingEnroll(true);

    // Clean up any abandoned unverified enrollment before starting a new
    // one — otherwise closing this page mid-setup (or the QR simply
    // expiring) and trying again piles up orphaned unverified factors.
    const { data: factorsData } = await supabase.auth.mfa.listFactors();
    const stale = factorsData?.all.filter((f) => f.factor_type === "totp" && f.status === "unverified") ?? [];
    for (const f of stale) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setStartingEnroll(false);

    if (error || !data) {
      setStartError(error?.message || "Couldn't start setup. Please try again.");
      return;
    }
    setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    setEnrollCode("");
    setEnrollError("");
  }

  function handleCancelEnroll() {
    // The unverified factor is left in place rather than unenrolled here —
    // the next "Add authenticator app" click sweeps up any abandoned ones
    // before starting fresh, so there's no orphan risk from just closing this.
    setEnrollment(null);
    setEnrollCode("");
    setEnrollError("");
  }

  async function handleConfirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollment) return;

    const trimmed = enrollCode.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setEnrollError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setEnrollSubmitting(true);
    setEnrollError("");
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollment.factorId, code: trimmed });
    setEnrollSubmitting(false);

    if (error) {
      setEnrollError(error.message);
      return;
    }
    setEnrollment(null);
    setEnrollCode("");
    await loadFactors();
  }

  async function handleRemove() {
    if (!activeFactor) return;
    setRemoving(true);
    setRemoveError("");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: activeFactor.id });
    setRemoving(false);

    if (error) {
      setRemoveError(error.message);
      return;
    }
    setConfirmingRemove(false);
    await loadFactors();
  }

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label="Back"
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">Security</h1>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-ink-secondary" />
          <h2 className="text-sm font-bold text-ink">Change Password</h2>
        </div>

        {passwordSaved && (
          <p className="text-xs text-brand bg-brand/5 border border-brand/20 rounded-xl py-2 px-3 mb-3">
            Password updated.
          </p>
        )}
        {passwordError && (
          <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
            {passwordError}
          </p>
        )}

        <form onSubmit={handleChangePassword}>
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Type it again"
          />
          <Button type="submit" size="sm" disabled={passwordSaving}>
            {passwordSaving ? "Saving…" : "Update password"}
          </Button>
        </form>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-1">
          {activeFactor ? (
            <ShieldCheck size={16} className="text-brand" />
          ) : (
            <ShieldPlus size={16} className="text-ink-secondary" />
          )}
          <h2 className="text-sm font-bold text-ink">Two-Factor Authentication</h2>
        </div>

        {loadingFactors ? (
          <p className="text-xs text-ink-muted mt-2">Checking status…</p>
        ) : enrollment ? (
          <div className="mt-2">
            <p className="text-xs text-ink-secondary mb-3">
              Scan this code with your authenticator app (like Google Authenticator or Authy), then enter the
              6-digit code it gives you.
            </p>
            <div className="flex justify-center mb-3">
              <img
                src={`data:image/svg+xml;utf-8,${encodeURIComponent(enrollment.qrCode)}`}
                alt="Scan with your authenticator app"
                className="w-40 h-40 rounded-xl border border-border bg-white p-2"
              />
            </div>
            <p className="text-[11px] text-ink-muted mb-1">Can't scan it? Enter this code manually:</p>
            <p className="text-xs font-mono text-ink bg-surface-sunken rounded-lg py-2 px-3 mb-3 break-all select-all">
              {enrollment.secret}
            </p>

            {enrollError && (
              <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
                {enrollError}
              </p>
            )}

            <form onSubmit={handleConfirmEnroll}>
              <Input
                label="Verification code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCancelEnroll} disabled={enrollSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={enrollSubmitting}>
                  {enrollSubmitting ? "Verifying…" : "Enable"}
                </Button>
              </div>
            </form>
          </div>
        ) : activeFactor ? (
          <div className="mt-2">
            <p className="text-xs text-ink-secondary mb-3">
              Authenticator app enabled. You'll be asked for a code from it each time you sign in.
            </p>
            {removeError && (
              <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
                {removeError}
              </p>
            )}
            <Button variant="danger" size="sm" onClick={() => setConfirmingRemove(true)}>
              Remove authenticator app
            </Button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-ink-secondary mb-3">
              Add an authenticator app for an extra layer of security when signing in.
            </p>
            {startError && (
              <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
                {startError}
              </p>
            )}
            <Button size="sm" onClick={handleStartEnroll} disabled={startingEnroll}>
              {startingEnroll ? "Starting…" : "Add authenticator app"}
            </Button>
          </div>
        )}
      </Card>

      <ConfirmModal
        open={confirmingRemove}
        title="Remove Two-Factor Authentication"
        message="You'll only need your password to sign in from now on. This makes your account less secure."
        confirmLabel="Remove"
        loading={removing}
        error={removeError}
        onConfirm={handleRemove}
        onCancel={() => setConfirmingRemove(false)}
      />
    </div>
  );
}
