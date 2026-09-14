import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";
import { useT } from "@/hooks/useI18n";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** True while the user arrived via a password-reset email link and still
   *  needs to choose a new password. The app must show the reset screen and
   *  nothing else until this clears — a recovery link creates a real session,
   *  so without this flag they'd land straight in the app with a password
   *  they've forgotten and never actually reset it. */
  recovering: boolean;
  endRecovery: () => void;
  /** True once a real session exists (`user` is set) but the session's
   *  Authenticator Assurance Level hasn't reached what the account's
   *  verified MFA factors require. This is true right after a plain
   *  email+password sign-in for anyone who has TOTP enabled — the password
   *  alone only ever earns aal1, so without this gate they'd land straight
   *  in the app having skipped the second factor entirely. */
  mfaRequired: boolean;
  /** Verifies a 6-digit TOTP code against the account's enrolled
   *  authenticator, elevating the session to aal2 on success. */
  verifyMfaCode: (code: string) => Promise<{ error: string | null }>;
}

// Survives a page reload within the same tab (never across tabs, devices,
// or browser restarts — sessionStorage, not localStorage) so a refresh
// while the reset-password screen is still up doesn't lose the fact that
// this session came from a recovery link. See the bootstrap effect below
// for why that matters.
const RECOVERING_STORAGE_KEY = "thrive-recovering";

function readRecoveringFlag(): boolean {
  try {
    return sessionStorage.getItem(RECOVERING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRecoveringFlag(value: boolean) {
  try {
    if (value) sessionStorage.setItem(RECOVERING_STORAGE_KEY, "1");
    else sessionStorage.removeItem(RECOVERING_STORAGE_KEY);
  } catch {
    // Best-effort only (private-browsing contexts can throw) — the worst
    // case is just the original bug (recovering doesn't survive a reload),
    // not a new one.
  }
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  recovering: false,
  endRecovery: () => {},
  mfaRequired: false,
  verifyMfaCode: async () => ({ error: "Not ready." }),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const t = useT();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  useEffect(() => {
    // aal2 is only ever "required" relative to what the account itself has
    // enrolled — nextLevel already reflects that, so this is safe to call
    // for every signed-in user, not just ones known to have MFA on.
    async function refreshMfaStatus() {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      setMfaRequired(!!data && data.nextLevel === "aal2" && data.currentLevel !== data.nextLevel);
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      // PASSWORD_RECOVERY (below) fires exactly once, right after Supabase
      // reads the recovery token out of the URL — this bootstrap path never
      // gets it again. Without restoring it here, reloading the page while
      // still on the reset-password screen would drop `recovering` back to
      // false and, since the recovery link already created a real session,
      // send the user straight into the app having never actually set a new
      // password. Only trusted if a real session also comes back from
      // Supabase — the flag alone is never enough on its own.
      if (session?.user && readRecoveringFlag()) setRecovering(true);
      if (session?.user) await refreshMfaStatus();
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Supabase fires this once, after it reads the recovery token out of the
      // URL on return from the reset email.
      if (event === "PASSWORD_RECOVERY") {
        writeRecoveringFlag(true);
        setRecovering(true);
      }
      // A fresh, ordinary sign-in is never part of a recovery flow — clear
      // any stale flag left over from an earlier recovery in this tab so it
      // can never leak into a later, unrelated session.
      if (event === "SIGNED_IN") writeRecoveringFlag(false);
      if (!session?.user) {
        setMfaRequired(false);
        return;
      }
      // Re-check on every meaningful auth event (sign-in, token refresh, the
      // MFA_CHALLENGE_VERIFIED event fired by a successful verify), not just
      // once at load — a factor can be enrolled, verified, or removed mid
      // session without the session itself being torn down and rebuilt.
      refreshMfaStatus();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function verifyMfaCode(code: string) {
    // The challenge needs a factor id, and enroll() only hands one back at
    // enrollment time — listFactors() is the one place to recover it for an
    // ordinary sign-in challenge, where all we have is "the user has MFA on".
    const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
    if (factorsErr) return { error: factorsErr.message };
    const factor = factorsData?.totp?.find((f) => f.status === "verified");
    if (!factor) return { error: t("mfa.noVerifiedFactor") };

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) return { error: error.message };
    setMfaRequired(false);
    return { error: null };
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        recovering,
        endRecovery: () => {
          writeRecoveringFlag(false);
          setRecovering(false);
        },
        mfaRequired,
        verifyMfaCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
