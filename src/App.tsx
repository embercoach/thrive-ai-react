import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppDataProvider } from "@/hooks/useAppData";
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
import type { ReactNode } from "react";

function Gate({ children }: { children: ReactNode }) {
  const { user, loading, recovering } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center text-ink-muted text-sm">
        Loading…
      </div>
    );
  }
  // Recovery takes priority over everything: a reset link creates a session,
  // so `user` is set here — without this the user would slip past into the app
  // without ever setting the new password they came to set.
  if (recovering) return <ResetPasswordPage />;
  if (!user) return <LoginPage />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Gate>
        <AppDataProvider>
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
        </AppDataProvider>
      </Gate>
    </AuthProvider>
  );
}

export default App;