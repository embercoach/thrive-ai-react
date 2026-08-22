import { useState } from "react";
import { supabase } from "@/services/supabase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Mode = "signin" | "signup" | "forgot";

export function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (mode === "forgot") {
      // redirectTo must be listed under Supabase Auth > URL Configuration >
      // Redirect URLs, or the link in the email is rejected. We send them
      // back to the app root; Supabase appends the recovery token, which
      // AuthProvider picks up as a PASSWORD_RECOVERY event.
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) setError(error.message);
      else setInfo("Check your email for a link to reset your password.");
      setLoading(false);
      return;
    }

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
    } else {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (data.user && !data.session) {
        setInfo("Check your email to confirm your account, then sign in.");
        setMode("signin");
      }
    }

    setLoading(false);
  }

  function toggleMode() {
    setMode((m) => (m === "signup" ? "signin" : m === "signin" ? "signup" : "signin"));
    setError("");
    setInfo("");
  }

  function showForgot() {
    setMode("forgot");
    setError("");
    setInfo("");
  }

  function backToSignIn() {
    setMode("signin");
    setError("");
    setInfo("");
  }

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden flex items-center justify-center px-6">
      {/* Ambient brand glow — quiet, not decorative noise */}
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

      <div
        className="w-full max-w-[380px] relative z-10"
        style={{ animation: "thrive-fade-in 0.5s ease-out" }}
      >
        <style>{`
          @keyframes thrive-fade-in {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <div className="bg-surface border border-border rounded-3xl p-8 shadow-xl shadow-black/5">
          {/* Signature mark: an ascending sparkline in a badge — a visual
              shorthand for "thriving" rather than a generic app icon. */}
          <div className="flex justify-center mb-5">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{ background: "var(--color-brand)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 16L9 10L13 14L21 6"
                  stroke="white"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 6H21V12"
                  stroke="white"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="3" cy="16" r="1.6" fill="white" />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-1.5">
            <h1 className="text-2xl font-bold text-ink tracking-tight">Thrive</h1>
            <span className="text-[11px] font-bold tracking-wide bg-brand/10 text-brand px-2 py-0.5 rounded-full">
              AI
            </span>
          </div>
          <p className="text-ink-secondary text-sm text-center mb-7">
            {mode === "signin"
              ? "Welcome back"
              : mode === "signup"
                ? "Let's get your money sorted"
                : "We'll email you a reset link"}
          </p>

          {error && (
            <p className="text-negative text-sm mb-4 text-center bg-negative/5 border border-negative/20 rounded-xl py-2 px-3">
              {error}
            </p>
          )}
          {info && (
            <p className="text-brand text-sm mb-4 text-center bg-brand/5 border border-brand/20 rounded-xl py-2 px-3">
              {info}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            {mode !== "forgot" && (
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
            )}
            {mode === "signin" && (
              <div className="text-right -mt-1 mb-1">
                <button
                  type="button"
                  onClick={showForgot}
                  className="text-xs font-semibold text-ink-secondary hover:text-brand transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}
            <Button type="submit" fullWidth disabled={loading} className="mt-3">
              {loading
                ? mode === "signin"
                  ? "Signing in…"
                  : mode === "signup"
                    ? "Creating account…"
                    : "Sending…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>

          {mode === "forgot" ? (
            <button
              type="button"
              onClick={backToSignIn}
              className="w-full text-center text-sm font-semibold text-brand hover:opacity-80 transition-opacity mt-6"
            >
              Back to sign in
            </button>
          ) : (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] uppercase tracking-wide text-ink-muted">
                  {mode === "signin" ? "New here" : "Have an account"}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <button
                type="button"
                onClick={toggleMode}
                className="w-full text-center text-sm font-semibold text-brand hover:opacity-80 transition-opacity"
              >
                {mode === "signin" ? "Create an account" : "Sign in instead"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}