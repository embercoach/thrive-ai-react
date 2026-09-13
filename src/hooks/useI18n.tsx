import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { en } from "@/lib/i18n/translations/en";

export interface LanguageOption {
  code: string;
  /** The language's own name, in its own script — shown in the picker so a
   *  reader who doesn't yet know the app is in English can still recognize
   *  their own language by its native spelling ("Español", not "Spanish"). */
  nativeLabel: string;
  /** Right-to-left script — flips base text direction. Layout mirroring
   *  (icons, paddings) is a further pass; this covers correct reading
   *  order, which matters far more than pixel-perfect mirroring. */
  rtl?: boolean;
}

// Every language this app supports, in the order shown in the picker.
// Adding a language later is: add a row here, add its translations file,
// import it into `translations` below — nothing else in the app changes.
export const LANGUAGES: LanguageOption[] = [
  { code: "en", nativeLabel: "English" },
  { code: "es", nativeLabel: "Español" },
  { code: "fr", nativeLabel: "Français" },
  { code: "pt", nativeLabel: "Português" },
  { code: "de", nativeLabel: "Deutsch" },
  { code: "hi", nativeLabel: "हिन्दी" },
];

const SUPPORTED_CODES = new Set(LANGUAGES.map((l) => l.code));

// `en` is the source of truth every other language is typed against (see
// each translations/<lang>.ts file) — TypeScript's excess/missing property
// checking on that direct object-literal assignment is what guarantees
// every language has every key, so a missing translation is a build
// failure here, never a silent blank string in production.
export type Translations = typeof en;

const translations: Record<string, Translations> = { en };

/** Registers a non-English language's translations once it's built —
 *  called from that language's own module so `useI18n.tsx` itself never
 *  needs editing again as languages are added. */
export function registerTranslations(code: string, dict: Translations) {
  translations[code] = dict;
}

function detectInitialLanguage(): string {
  try {
    const stored = localStorage.getItem("thrive-language");
    if (stored && SUPPORTED_CODES.has(stored)) return stored;
  } catch {
    // localStorage can throw in some private-browsing contexts — fall
    // through to the browser-language guess rather than failing to load.
  }
  const browserLang = typeof navigator !== "undefined" ? navigator.language?.split("-")[0] : undefined;
  if (browserLang && SUPPORTED_CODES.has(browserLang)) return browserLang;
  return "en";
}

/** Looks up a dotted key path ("home.availableToSpend") in a nested
 *  translations object, falling back to English (and then to the key
 *  itself) if a path is missing at runtime — defensive against a language
 *  file that's momentarily out of sync with `en` during development,
 *  since TypeScript only catches that at build time, not for data that
 *  somehow bypasses it. */
function lookup(dict: Record<string, unknown>, path: string): string | undefined {
  let node: unknown = dict;
  for (const segment of path.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

interface I18nContextValue {
  language: string;
  languageOption: LanguageOption;
  /** Updates the local/display language immediately. Persisting the choice
   *  to the signed-in user's account (so it follows them to another
   *  device) is the caller's job — see ProfilePage's language picker —
   *  since this provider intentionally has no auth/profile dependency, so
   *  it also works correctly on the pre-login screens. */
  setLanguage: (code: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<string>(detectInitialLanguage);

  const setLanguage = useCallback((code: string) => {
    if (!SUPPORTED_CODES.has(code)) return;
    setLanguageState(code);
    try {
      localStorage.setItem("thrive-language", code);
    } catch {
      // Best-effort persistence only — an in-session language change still
      // works even if this throws (e.g. private browsing).
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = LANGUAGES.find((l) => l.code === language)?.rtl ? "rtl" : "ltr";
  }, [language]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = translations[language] ?? translations.en;
      const value = lookup(dict, key) ?? lookup(translations.en, key) ?? key;
      return interpolate(value, vars);
    },
    [language]
  );

  const languageOption = useMemo(
    () => LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0],
    [language]
  );

  const value = useMemo(
    () => ({ language, languageOption, setLanguage, t }),
    [language, languageOption, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** The full context — language, languageOption, and setLanguage — for the
 *  one place (ProfilePage) that needs to change or display the current
 *  language itself. Everywhere else should use `useT()` below instead. */
export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** What almost every component actually wants: just the translate
 *  function, without also subscribing to (and re-rendering on) the
 *  LanguageOption object identity. */
export function useT() {
  return useI18n().t;
}
