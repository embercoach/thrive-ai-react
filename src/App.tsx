import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppDataProvider, useAppData } from "@/hooks/useAppData";
import { AppLayout } from "@/layouts/AppLayout";
import { HomePage } from "@/pages/HomePage";
import { SpendingPage } from "@/pages/SpendingPage";
import { CategoryDetailPage } from "@/pages/CategoryDetailPage";
import { GoalsPage } from "@/pages/GoalsPage";
import { AdvisorPage } from "@/pages/AdvisorPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AboutPage } from "@/pages/AboutPage";
import { HelpFeedbackPage } from "@/pages/HelpFeedbackPage";
import { LoginPage } from "@/pages/LoginPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
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
  const { user, loading, recovering } = useAuth();
  if (loading) return <AuthSpinner />;
  // Recovery takes priority over everything: a reset link creates a session,
  // so `user` is set here — without this the user would slip past into the app
  // without ever setting the new password they came to set.
  if (recovering) return <ResetPasswordPage />;
  if (!user) return <LoginPage />;
  return <>{children}</>;
}

/** Sits inside AppDataProvider because it needs the loaded profile to know
 *  whether first-run setup is still outstanding. `loading` here only ever
 *  covers the very first fetch (see useAppData) — later refetches update
 *  data in place without falling back through this gate again. */
function OnboardingGate({ children }: { children: ReactNode }) {
  const { profile, loading } = useAppData();
  if (loading) return <HomeSkeleton />;
  if (profile && !profile.onboarded) return <OnboardingPage />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Gate>
        <AppDataProvider>
          <OnboardingGate>
          <BrowserRouter>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/spending" element={<SpendingPage />} />
                <Route path="/spending/:category" element={<CategoryDetailPage />} />
                <Route path="/ai" element={<AdvisorPage />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/help" element={<HelpFeedbackPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
          </OnboardingGate>
        </AppDataProvider>
      </Gate>
    </AuthProvider>
  );
}

export default App;