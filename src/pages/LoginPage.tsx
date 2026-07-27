import { useState } from "react";
import { supabase } from "@/services/supabase";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-6">
      <div className="w-full max-w-[380px]">
        <h1 className="text-2xl font-bold text-ink text-center mb-1">Thrive AI</h1>
        <p className="text-ink-secondary text-sm text-center mb-6">Welcome back</p>
        {error && <p className="text-negative text-sm mb-3 text-center">{error}</p>}
        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
          <Button type="submit" fullWidth disabled={loading} className="mt-2">
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
