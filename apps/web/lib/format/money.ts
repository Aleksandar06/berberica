/**
 * Money formatting helpers. Prices are stored as integer minor units
 * (cents / стотинки / pence) on the server; the UI converts to major
 * units only at the display boundary.
 *
 * Uses `Intl.NumberFormat` so a EUR price renders as "€25.00", an MKD
 * price as "MKD 1,500" (no fractional unit for denar by default), etc.
 * The user's browser locale picks the grouping/decimal characters — a
 * customer in Macedonia sees their local conventions for a EUR-priced
 * service hosted in Skopje.
 */

/** Convert integer minor units → major units number (25.0 for 2500 cents). */
export function centsToMajor(cents: number): number {
  return cents / 100;
}

/** Convert a user-typed major-unit value → integer cents, rounded safely. */
export function majorToCents(major: number): number {
  // Round to nearest cent — guards against float drift in "9.99" inputs.
  return Math.round(major * 100);
}

/**
 * Render `cents` in the given ISO 4217 currency. Null/undefined returns a
 * fallback ("Ask for price" by default) — callers can override for places
 * where a 0 is more appropriate (e.g. an empty earnings cell).
 */
export function formatPrice(
  cents: number | null | undefined,
  currency: string,
  options: { fallback?: string; locale?: string } = {},
): string {
  if (cents === null || cents === undefined) {
    return options.fallback ?? "Ask for price";
  }
  try {
    return new Intl.NumberFormat(options.locale, {
      style: "currency",
      currency,
    }).format(centsToMajor(cents));
  } catch {
    // Unknown currency code → fallback to a plain "CODE 12.34" rendering
    // so we don't crash a tenant view if currency got corrupted.
    return `${currency} ${centsToMajor(cents).toFixed(2)}`;
  }
}

/**
 * Same as `formatPrice` but never returns a "Ask for price" fallback —
 * a null value renders as currency-zero. Used in earnings tables where
 * the cell must always be a number.
 */
export function formatMoney(cents: number, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(centsToMajor(cents));
  } catch {
    return `${currency} ${centsToMajor(cents).toFixed(2)}`;
  }
}
