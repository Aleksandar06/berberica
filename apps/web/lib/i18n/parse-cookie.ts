import { DEFAULT_LOCALE, LOCALES, type Locale } from "./dictionary";

/**
 * Pure helper: validate a raw cookie value and coerce it to a known locale.
 * Lives in its own module (no "use client", no next/headers import) so both
 * server and client code paths can call it without crossing boundaries.
 */
export function parseLocaleCookie(raw: string | undefined): Locale {
  if (raw && (LOCALES as readonly string[]).includes(raw)) {
    return raw as Locale;
  }
  return DEFAULT_LOCALE;
}
