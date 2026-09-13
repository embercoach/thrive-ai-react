import { useState } from "react";
import { supabase } from "@/services/supabase";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useT } from "@/hooks/useI18n";

/**
 * Shown only while `recovering` is true — i.e. the user followed a password
 * reset link from their email. Supabase has already put them in a temporary
 * recovery session, so all we have to do is collect a new password and call
 * updateUser. On success the session becomes a normal one and endRecovery()
 * drops them straight into the app, already signed in.
 */
export function ResetPasswordPage() {
  const t = useT();
  const { endRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError(t("resetPassword.passwordMinLength"));
      return;
    }
    if (password !== confirm) {
      setError(t("resetPassword.passwordsDontMatch"));
      return;
    }

    setSaving(true);
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (updErr) {
      setError(updErr.message);
      return;
    }
    setDone(true);
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

          {done ? (
            <div className="text-center">
              <h1 className="text-xl font-bold text-ink mb-1.5">{t("resetPassword.doneTitle")}</h1>
              <p className="text-ink-secondary text-sm mb-6">
                {t("resetPassword.doneSubtitle")}
              </p>
              <Button fullWidth onClick={endRecovery}>
                {t("resetPassword.continueToThrive")}
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-ink text-center mb-1.5">{t("resetPassword.title")}</h1>
              <p className="text-ink-secondary text-sm text-center mb-7">
                {t("resetPassword.subtitle")}
              </p>

              {error && (
                <p className="text-negative text-sm mb-4 text-center bg-negative/5 border border-negative/20 rounded-xl py-2 px-3">
                  {error}
                </p>
              )}

              <form onSubmit={handleSubmit}>
                <Input
                  label={t("resetPassword.newPasswordLabel")}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("resetPassword.newPasswordPlaceholder")}
                />
                <Input
                  label={t("resetPassword.confirmPasswordLabel")}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t("resetPassword.confirmPasswordPlaceholder")}
                />
                <Button type="submit" fullWidth disabled={saving} className="mt-3">
                  {saving ? t("resetPassword.saving") : t("resetPassword.updatePassword")}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
