import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppDataProvider, useAppData } from "@/hooks/useAppData";
import { I18nProvider } from "@/hooks/useI18n";
import { LanguageSync } from "@/components/LanguageSync";
import { AppLayout } from "@/layouts/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { SpendingPage } from "@/pages/SpendingPage";
import { CategoryDetailPage } from "@/pages/CategoryDetailPage";
import { GoalsPage } from "@/pages/GoalsPage";
import { AdvisorPage } from "@/pages/AdvisorPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { SecurityPage } from "@/pages/SecurityPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ConnectedBanksPage } from "@/pages/ConnectedBanksPage";
import { AssetsPage } from "@/pages/AssetsPage";
import { AboutPage } from "@/pages/AboutPage";
import { HelpFeedbackPage } from "@/pages/HelpFeedbackPage";
import { PrivacyPolicyPage } from "@/pages/PrivacyPolicyPage";
import { TermsOfServicePage } from "@/pages/TermsOfServicePage";
import { LoginPage } from "@/pages/LoginPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { MfaChallengePage } from "@/pages/MfaChallengePage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { HomeSkeleton } from "@/components/ui/HomeSkeleton";
import type { ReactNode } from "react";

/** Brief, layout-free spinner for the one moment there's genuinely no page
 *  to sketch a skeleton of yet — before we even know if anyone's logged in. */
function AuthSpinner() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-border-strong border-t-brand animate-spin" />
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { user, loading, recovering, mfaRequired } = useAuth();
  if (loading) return <AuthSpinner />;
  // Recovery takes priority over everything: a reset link creates a session,
  // so `user` is set here — without this the user would slip past into the app
  // without ever setting the new password they came to set.
  if (recovering) return <ResetPasswordPage />;
  if (!user) return <LoginPage />;
  // A password sign-in only ever earns aal1. Anyone with a verified TOTP
  // factor must clear the second-factor challenge before reaching the app,
  // or 2FA would just be decorative.
  if (mfaRequired) return <MfaChallengePage />;
  return <>{children}</>;
}

/** Sits inside AppDataProvider because it needs the loaded profile to know
 *  whether first-run setup is still outstanding. `loading` here only ever
 *  covers the very first fetch (see useAppData) — later refetches update
 *  data in place without falling back through this gate again. */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { profile, loading } = useAppData();
  if (loading) return <HomeSkeleton />;
  // `profile` is only ever null here for a genuinely new signup whose
  // profile row hasn't been created yet (see fetchProfile's PGRST116
  // handling) — a transient fetch error is caught inside useAppData's
  // refetch() and falls back to the last known profile instead of ever
  // surfacing as null, so this can't mistake "briefly unreachable" for
  // "not onboarded" and bounce an already-onboarded user back here.
  if (!profile || !profile.onboarded) return <OnboardingPage />;
  return <>{children}</>;
}

/**
 * Everything that must be reachable whether or not anyone is signed in —
 * currently just the legal pages. Kept as its own small routes block so
 * it's obvious at a glance which paths intentionally bypass Gate, rather
 * than that being a fact you have to reconstruct from where each page
 * happens to sit in the tree.
 */
function PublicRoutes() {
  return (
    <Routes>
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsOfServicePage />} />
      <Route
        path="*"
        element={
          <Gate>
            <AppDataProvider>
              <LanguageSync />
              <OnboardingGate>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/spending" element={<SpendingPage />} />
                    <Route path="/spending/:category" element={<CategoryDetailPage />} />
                    <Route path="/ai" element={<AdvisorPage />} />
                    <Route path="/goals" element={<GoalsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/security" element={<SecurityPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/connected-banks" element={<ConnectedBanksPage />} />
                    <Route path="/assets" element={<AssetsPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    <Route path="/help" element={<HelpFeedbackPage />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </OnboardingGate>
            </AppDataProvider>
          </Gate>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    // Outermost, alongside AuthProvider — Login, the MFA challenge, and
    // password reset all need translated text before there's any signed-in
    // profile to read a language preference from, which is exactly why
    // I18nProvider itself has zero auth/profile dependency (device-local
    // detection only). LanguageSync below is the one place that later
    // layers the signed-in user's saved preference on top of that.
    //
    // BrowserRouter now wraps Gate (rather than sitting inside it) so that
    // /privacy and /terms are real, linkable URLs reachable before signing
    // in — Gate previously short-circuited straight to <LoginPage /> for
    // every path when signed out, which meant a URL typed into the address
    // bar, or a link from LoginPage's own footer, had nowhere to go.
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <PublicRoutes />
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;