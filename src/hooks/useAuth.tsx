import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabase";

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
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  recovering: false,
  endRecovery: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      // Supabase fires this once, after it reads the recovery token out of the
      // URL on return from the reset email.
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, recovering, endRecovery: () => setRecovering(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
