import { useState } from "react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useT } from "@/hooks/useI18n";

/**
 * Shown only while `mfaRequired` is true — a password sign-in earns aal1,
 * and this account has a verified TOTP factor that requires aal2. Nothing
 * else renders until this clears, mirroring how ResetPasswordPage gates the
 * app during password recovery.
 */
export function MfaChallengePage() {
  const t = useT();
  const { verifyMfaCode } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError(t("mfa.invalidCode"));
      return;
    }

    setVerifying(true);
    const { error: verifyErr } = await verifyMfaCode(trimmed);
    setVerifying(false);

    if (verifyErr) {
      setError(verifyErr);
      setCode("");
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    // signOut() resolves with { error } rather than throwing — an expired
    // session token or a transient network error left this unchecked, so
    // `signingOut` stayed true forever with no way off the challenge screen
    // (the only other way out is completing 2FA) and no error shown.
    const { error: signOutErr } = await supabase.auth.signOut();
    if (signOutErr) {
      setError(t("mfa.signOutError"));
      setSigningOut(false);
      return;
    }
    // No need to clear signingOut on success — a successful sign-out
    // unmounts this whole page via the auth gate.
  }

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden flex items-center justify-center px-6">
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
        <div className="bg-surface border border-border rounded-3xl p-8 shadow-xl shadow-black/5">
          <div className="flex justify-center mb-5">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--color-brand)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M3 16L9 10L13 14L21 6" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M15 6H21V12" stroke="white" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="3" cy="16" r="1.6" fill="white" />
              </svg>
            </div>
          </div>

          <h1 className="text-xl font-bold text-ink text-center mb-1.5">{t("mfa.title")}</h1>
          <p className="text-ink-secondary text-sm text-center mb-7">
            {t("mfa.subtitle")}
          </p>

          {error && (
            <p className="text-negative text-sm mb-4 text-center bg-negative/5 border border-negative/20 rounded-xl py-2 px-3">
              {error}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <Input
              label={t("mfa.verificationCodeLabel")}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="tracking-[0.3em] text-center"
            />
            <Button type="submit" fullWidth disabled={verifying} className="mt-3">
              {verifying ? t("mfa.verifying") : t("mfa.verify")}
            </Button>
          </form>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-center text-sm font-semibold text-ink-secondary hover:text-ink transition-colors mt-6 disabled:opacity-50"
          >
            {signingOut ? t("mfa.signingOut") : t("mfa.signOutInstead")}
          </button>
        </div>
      </div>
    </div>
  );
}
