import { useEffect, useRef } from "react";
import { useAppData } from "@/hooks/useAppData";
import { useI18n } from "@/hooks/useI18n";

/**
 * Bridges the signed-in user's saved `profile.language` into the i18n
 * context once it's loaded, so a language chosen on one device follows the
 * account to another. Lives inside AppDataProvider (not I18nProvider
 * itself) deliberately — I18nProvider has zero auth/profile dependency so
 * it also works correctly on the pre-login screens (Login, MFA, password
 * reset), and this is the one place that connects the two.
 *
 * Only applies the server value once per change to it — a user picking a
 * different language from the Profile page updates local state (and
 * localStorage) immediately via setLanguage(), and then also writes that
 * same value to profile.language; this effect seeing that new value come
 * back through wouldn't be wrong to re-apply, but tracking "last applied"
 * avoids a redundant setLanguage call on every unrelated profile refetch.
 */
export function LanguageSync() {
  const { profile } = useAppData();
  const { setLanguage } = useI18n();
  const lastApplied = useRef<string | undefined>(undefined);

  useEffect(() => {
    const lang = profile?.language;
    if (!lang || lang === lastApplied.current) return;
    lastApplied.current = lang;
    setLanguage(lang);
  }, [profile?.language, setLanguage]);

  return null;
}
