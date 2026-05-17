"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { type Dictionary, type Locale } from "./dictionary";
import { en } from "./messages.en";
import { mk } from "./messages.mk";

export { parseLocaleCookie } from "./parse-cookie";

const MESSAGES: Record<Locale, Dictionary> = { en, mk };

interface LanguageContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Wraps the app and exposes the current locale + a `t` accessor.
 *
 * SSR-friendly: the root layout reads the `lang` cookie and passes the
 * value as `initialLocale`. The provider then mirrors that into the
 * `<html lang>` attribute and into a cookie that lives long enough to
 * survive a session (180 days). No hydration flash because the server
 * already rendered with the right locale.
 */
export function LanguageProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Keep the <html lang> attribute in sync so screen readers, browser
  // hyphenation, and Google Translate behave correctly.
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof document !== "undefined") {
      // 180-day cookie, root path, SameSite=Lax (default). Not HttpOnly so
      // future client-side reads work without an extra round-trip.
      const maxAge = 60 * 60 * 24 * 180;
      document.cookie = `lang=${next}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ locale, setLocale, t: MESSAGES[locale] }),
    [locale, setLocale],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * The translation hook used by every client component.
 *
 *   const { t } = useT();
 *   <button>{t.common.save}</button>
 *
 * The dictionary is statically typed, so a missing key is a compile
 * error — there's no "translation missing" fallback to babysit at
 * runtime.
 */
export function useT(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useT must be used inside <LanguageProvider>");
  }
  return ctx;
}

