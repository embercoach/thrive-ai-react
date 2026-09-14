import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, KeyRound, ShieldCheck, ShieldPlus, TriangleAlert } from "lucide-react";
import type { Factor } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Modal } from "@/components/ui/Modal";
import { useT } from "@/hooks/useI18n";
import { useAppData } from "@/hooks/useAppData";

interface EnrollingFactor {
  factorId: string;
  qrCode: string;
  secret: string;
}

export function SecurityPage() {
  const navigate = useNavigate();
  const t = useT();
  const { isPro } = useAppData();

  // --- Delete account ---
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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
  const [factorsError, setFactorsError] = useState("");

  const loadFactors = useCallback(async () => {
    setLoadingFactors(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      // A failed check must never be shown as "no 2FA enabled" — that's a
      // materially different, falsely-reassuring state for someone who
      // actually does have it on. Surface the failure and let them retry
      // instead of silently defaulting to "off".
      setFactorsError(error.message);
      setLoadingFactors(false);
      return;
    }
    setFactorsError("");
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
      setPasswordError(t("misc.security.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("misc.security.passwordsDontMatch"));
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
      setStartError(error?.message || t("misc.security.startErrorFallback"));
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
      setEnrollError(t("misc.security.invalidCode"));
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

  function handleOpenDelete() {
    setDeleteConfirmText("");
    setDeleteError("");
    setConfirmingDelete(true);
  }

  function handleCancelDelete() {
    // Only closable via this handler, not the modal's own backdrop/X —
    // preventClose is set below so an accidental tap outside the sheet
    // can't dismiss it mid-typing, but Cancel always works.
    setConfirmingDelete(false);
    setDeleteConfirmText("");
    setDeleteError("");
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setDeleteError(t("misc.security.deleteAccountError"));
      setDeleting(false);
      return;
    }

    try {
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setDeleteError(t("misc.security.deleteAccountError"));
        setDeleting(false);
        return;
      }
    } catch {
      setDeleteError(t("misc.security.deleteAccountError"));
      setDeleting(false);
      return;
    }

    // The account and every row behind it are gone server-side at this
    // point. signOut() clears the local session so the auth gate drops
    // straight to the login screen instead of holding on to now-invalid
    // tokens — no need to reset `deleting`/close the modal on success,
    // this unmounts the whole page the same way handleSignOut does.
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="px-4 pt-6 pb-4 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate("/profile")}
          aria-label={t("misc.security.backAria")}
          className="text-ink-secondary cursor-pointer -ml-1 p-1"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-ink">{t("misc.security.title")}</h1>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={16} className="text-ink-secondary" />
          <h2 className="text-sm font-bold text-ink">{t("misc.security.changePasswordTitle")}</h2>
        </div>

        {passwordSaved && (
          <p className="text-xs text-brand bg-brand/5 border border-brand/20 rounded-xl py-2 px-3 mb-3">
            {t("misc.security.passwordUpdated")}
          </p>
        )}
        {passwordError && (
          <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
            {passwordError}
          </p>
        )}

        <form onSubmit={handleChangePassword}>
          <Input
            label={t("misc.security.newPasswordLabel")}
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("misc.security.newPasswordPlaceholder")}
          />
          <Input
            label={t("misc.security.confirmPasswordLabel")}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("misc.security.confirmPasswordPlaceholder")}
          />
          <Button type="submit" size="sm" disabled={passwordSaving}>
            {passwordSaving ? t("misc.security.saving") : t("misc.security.updatePassword")}
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
          <h2 className="text-sm font-bold text-ink">{t("misc.security.twoFactorTitle")}</h2>
        </div>

        {loadingFactors ? (
          <p className="text-xs text-ink-muted mt-2">{t("misc.security.checkingStatus")}</p>
        ) : factorsError ? (
          <div className="mt-2">
            <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
              {t("misc.security.checkFactorsError")}
            </p>
            <Button size="sm" variant="outline" onClick={loadFactors}>
              {t("misc.security.retry")}
            </Button>
          </div>
        ) : enrollment ? (
          <div className="mt-2">
            <p className="text-xs text-ink-secondary mb-3">{t("misc.security.scanInstructions")}</p>
            <div className="flex justify-center mb-3">
              <img
                src={`data:image/svg+xml;utf-8,${encodeURIComponent(enrollment.qrCode)}`}
                alt={t("misc.security.qrAlt")}
                className="w-40 h-40 rounded-xl border border-border bg-white p-2"
              />
            </div>
            <p className="text-[11px] text-ink-muted mb-1">{t("misc.security.manualEntryLabel")}</p>
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
                label={t("misc.security.verificationCodeLabel")}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={enrollCode}
                onChange={(e) => setEnrollCode(e.target.value.replace(/\D/g, ""))}
                placeholder={t("misc.security.verificationCodePlaceholder")}
              />
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCancelEnroll} disabled={enrollSubmitting}>
                  {t("misc.security.cancel")}
                </Button>
                <Button type="submit" size="sm" disabled={enrollSubmitting}>
                  {enrollSubmitting ? t("misc.security.verifying") : t("misc.security.enable")}
                </Button>
              </div>
            </form>
          </div>
        ) : activeFactor ? (
          <div className="mt-2">
            <p className="text-xs text-ink-secondary mb-3">{t("misc.security.enabledDescription")}</p>
            {removeError && (
              <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
                {removeError}
              </p>
            )}
            <Button variant="danger" size="sm" onClick={() => setConfirmingRemove(true)}>
              {t("misc.security.removeButton")}
            </Button>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-ink-secondary mb-3">{t("misc.security.addDescription")}</p>
            {startError && (
              <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
                {startError}
              </p>
            )}
            <Button size="sm" onClick={handleStartEnroll} disabled={startingEnroll}>
              {startingEnroll ? t("misc.security.starting") : t("misc.security.addButton")}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-1">
          <TriangleAlert size={16} className="text-negative" />
          <h2 className="text-sm font-bold text-ink">{t("misc.security.dangerZoneTitle")}</h2>
        </div>
        <p className="text-xs text-ink-secondary mb-3 mt-2">{t("misc.security.deleteAccountDescription")}</p>
        <Button variant="danger" size="sm" onClick={handleOpenDelete}>
          {t("misc.security.deleteAccountButton")}
        </Button>
      </Card>

      <ConfirmModal
        open={confirmingRemove}
        title={t("misc.security.removeModalTitle")}
        message={t("misc.security.removeModalMessage")}
        confirmLabel={t("misc.security.removeModalConfirm")}
        loading={removing}
        error={removeError}
        onConfirm={handleRemove}
        onCancel={() => setConfirmingRemove(false)}
      />

      <Modal
        open={confirmingDelete}
        onClose={handleCancelDelete}
        title={t("misc.security.deleteAccountModalTitle")}
        preventClose={deleting}
      >
        <p className="text-sm text-ink-secondary mb-3">{t("misc.security.deleteAccountModalMessage")}</p>
        {isPro && (
          <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
            {t("misc.security.deleteAccountProWarning")}
          </p>
        )}
        {deleteError && (
          <p className="text-xs text-negative bg-negative/5 border border-negative/20 rounded-xl py-2 px-3 mb-3">
            {deleteError}
          </p>
        )}
        <Input
          label={t("misc.security.deleteAccountConfirmLabel")}
          type="text"
          autoComplete="off"
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder={t("misc.security.deleteAccountConfirmPlaceholder")}
          disabled={deleting}
        />
        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={handleCancelDelete} disabled={deleting}>
            {t("misc.security.cancel")}
          </Button>
          <Button
            variant="danger"
            fullWidth
            onClick={handleDeleteAccount}
            disabled={deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
          >
            {deleting ? t("misc.security.deleting") : t("misc.security.deleteAccountButtonConfirm")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
