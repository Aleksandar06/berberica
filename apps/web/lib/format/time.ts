import { DateTime } from "luxon";

/**
 * Time display helpers. The API returns each slot as BOTH a UTC instant
 * (`startUtc`) and a tenant-local wall-clock display string (`displayTime`).
 *
 * Strategy: prefer the API's `displayTime` for the visible label (it's
 * authoritative — derived from the tenant TZ on the server). Use Luxon
 * locally only for date pickers and confirmation pages where we need to
 * format other timestamps.
 *
 * Why surface the timezone in the UI: a customer in Berlin booking with a
 * Skopje business should see "10:00 Europe/Skopje" so it's obvious which
 * clock the time refers to.
 */

/** "Monday, June 1, 2026" in the given zone, English locale. */
export function formatDateLong(iso: string, zone: string): string {
  return DateTime.fromISO(iso, { zone: "utc" })
    .setZone(zone)
    .setLocale("en-US")
    .toLocaleString({
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
}

/** Short "HH:mm" in zone. Useful when we don't trust an API-provided string. */
export function formatTimeShort(iso: string, zone: string): string {
  return DateTime.fromISO(iso, { zone: "utc" }).setZone(zone).toFormat("HH:mm");
}

/** YYYY-MM-DD in zone — used as the `date` parameter for availability calls. */
export function formatDateKey(iso: string, zone: string): string {
  return DateTime.fromISO(iso, { zone: "utc" })
    .setZone(zone)
    .toFormat("yyyy-LL-dd");
}

/** Today in the tenant's TZ as YYYY-MM-DD — the floor of the date picker. */
export function todayInZone(zone: string): string {
  return DateTime.now().setZone(zone).toFormat("yyyy-LL-dd");
}

/** N days from today in the tenant's TZ — the ceiling of the date picker. */
export function dateInZonePlusDays(zone: string, days: number): string {
  return DateTime.now().setZone(zone).plus({ days }).toFormat("yyyy-LL-dd");
}
