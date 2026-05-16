/**
 * Shared primitive schemas. Reused by every domain schema in this package.
 * Pure validation — no Prisma, no env, no network. Safe for browser bundles.
 */
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { z } from "zod";

// ===========================================================================
// SLUG
// ===========================================================================

/**
 * Slugs reserved for platform-level routes; cannot be used as tenant slugs.
 *
 * Kept in lockstep with:
 *   • apps/api/src/common/reserved-slugs.ts
 *   • the CHECK constraint `tenants_slug_reserved_chk` in the init migration
 *
 * If you add or remove an entry, update all three.
 */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "dashboard",
  "login",
  "register",
  "pricing",
  "support",
  "terms",
  "privacy",
  "settings",
  "account",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

// DNS-style: lowercase ASCII alphanumeric, optional internal hyphens, length 1–63.
// Mirrors the `tenants_slug_format_chk` regex in the init migration.
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const slugSchema = z
  .string()
  .min(1, "Slug is required")
  .max(63, "Slug must be 63 characters or fewer")
  .regex(
    SLUG_REGEX,
    "Slug must be lowercase, alphanumeric, may contain internal hyphens",
  )
  .refine(
    (s) => !(RESERVED_SLUGS as readonly string[]).includes(s),
    { message: "This slug is reserved and cannot be used" },
  );

// ===========================================================================
// TIMEZONE (IANA)
// ===========================================================================

/**
 * Validates against the JS runtime's IANA timezone list.
 *
 * Strategy:
 *   1. Fast path: `Intl.supportedValuesOf("timeZone")` (ES2023). Returns only
 *      *canonical* zone IDs (e.g. "Etc/UTC" but not the "UTC" alias), so a
 *      Set hit is a definitive yes.
 *   2. Slow path: a Set miss is NOT a definitive no — runtimes accept many
 *      aliases. We re-check with `Intl.DateTimeFormat({ timeZone })`, which
 *      throws `RangeError` on unknown zones and accepts aliases. This covers
 *      "UTC", "GMT", and similar shortcuts that tenants reasonably enter.
 *
 * We deliberately do NOT ship a hardcoded TZ list — that would rot as IANA
 * publishes updates. Trusting the runtime gets us automatic refreshes.
 */
const SUPPORTED_TIMEZONES: ReadonlySet<string> | null = (() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sv: unknown = (Intl as any).supportedValuesOf;
  if (typeof sv !== "function") return null;
  try {
    const list = (sv as (k: string) => string[]).call(Intl, "timeZone");
    return new Set<string>(list);
  } catch {
    return null;
  }
})();

function isValidTimezone(tz: string): boolean {
  if (SUPPORTED_TIMEZONES?.has(tz)) return true;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z
  .string()
  .min(1, "Timezone is required")
  .refine(isValidTimezone, { message: "Not a valid IANA timezone" });

// ===========================================================================
// EMAIL / PHONE / HEX / UUID
// ===========================================================================

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Invalid email address")
  .max(320, "Email address too long");

/**
 * Phone numbers are NORMALIZED to E.164 by libphonenumber-js. The parsed
 * canonical string ("+38970000001") is what consumers receive after parse.
 * Bare local-format inputs (e.g. "070000001" with no country code) are
 * rejected because libphonenumber can't determine the country.
 */
export const phoneSchema = z
  .string()
  .trim()
  .transform((raw, ctx): string => {
    const parsed = parsePhoneNumberFromString(raw);
    if (!parsed || !parsed.isValid()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Invalid phone number — include country code in E.164 format",
      });
      return z.NEVER;
    }
    // Widen libphonenumber-js's `E164Number` branded type to plain `string`
    // so downstream `z.infer<>` doesn't leak the library type into the
    // consumer's `.d.ts`. The runtime value is still the canonical E.164.
    return parsed.number as string;
  });

export const hexColorSchema = z
  .string()
  .regex(
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
    "Invalid hex color — use #RGB or #RRGGBB",
  );

export const uuidSchema = z.string().uuid("Invalid UUID");

// ===========================================================================
// TIME / DAY / SLOT DURATION
// ===========================================================================

/**
 * Allowed slot durations in minutes. Used by tenant settings and per-rule
 * overrides on availability rules.
 */
export const SLOT_DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120] as const;
export type SlotDuration = (typeof SLOT_DURATIONS)[number];

export const slotDurationSchema = z
  .number()
  .int()
  .refine(
    (n): n is SlotDuration =>
      (SLOT_DURATIONS as readonly number[]).includes(n),
    {
      message: `Slot duration must be one of ${SLOT_DURATIONS.join(", ")} minutes`,
    },
  );

/** Wall-clock time in 24-hour HH:mm format (e.g. "09:00", "17:30"). */
export const TIME_STRING_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const timeStringSchema = z
  .string()
  .regex(TIME_STRING_REGEX, "Time must be HH:mm in 24-hour format");

/**
 * Helper: lexical compare works for HH:mm because the format is fixed-width
 * and zero-padded. Exposed so domain refinements use the same comparator.
 */
export function timeStringIsBefore(a: string, b: string): boolean {
  return a < b;
}

/** Day-of-week. 0 = Sunday … 6 = Saturday (matches JS Date.getDay() and the DB). */
export const dayOfWeekSchema = z
  .number()
  .int()
  .min(0, "dayOfWeek must be between 0 and 6")
  .max(6, "dayOfWeek must be between 0 and 6");

// ===========================================================================
// DATE (YYYY-MM-DD) helpers — used by exception / availability-query schemas
// ===========================================================================

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** Strict ISO YYYY-MM-DD; rejects invalid calendar dates (e.g. 2026-02-30). */
export const isoDateSchema = z
  .string()
  .regex(ISO_DATE_REGEX, "Date must be YYYY-MM-DD")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }, "Invalid calendar date");

/** True if `s` (YYYY-MM-DD) is today or later in UTC. */
export function isoDateIsTodayOrFuture(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  const candidate = Date.UTC(y, m - 1, d);
  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return candidate >= todayUtc;
}
