/**
 * =============================================================================
 *  CAPACITY PREVIEW ENGINE — admin dashboard analysis
 * =============================================================================
 *
 *  Step 10 of the build. Produces a "what could fit on this day" report for
 *  one (staff, service, date).
 *
 *  Two numbers the prompt insists must be kept conceptually separate:
 *    1. validStartTimes / invalidStartTimes — how the slot grid maps to
 *       customer-visible options. Computed by REUSING the Step 9 engine in
 *       preview mode so the validity rules stay in one place.
 *    2. maxNonOverlappingBookings — packing of (service + buffers) blocks
 *       into the day's free sub-windows. A bigger number than the count of
 *       valid start times in cases where slot duration ≠ service duration.
 *
 *  Modes:
 *    • theoretical → ignore existing bookings (and lead time). "If this day
 *      were empty, what could fit?" Useful when sizing slot durations.
 *    • real_day    → subtract active bookings from the free time. "Given
 *      what's already booked, how much capacity is left today?"
 *
 *  All time math runs in minutes-since-midnight in the TENANT timezone —
 *  capacity is a same-day, single-zone calculation. UTC-anchored existing
 *  bookings are converted to local minutes upfront and clipped to the day.
 * =============================================================================
 */

import { DateTime } from "luxon";

import {
  computeAvailableSlots,
  type ComputeAvailableSlotsInput,
  type EngineBreak,
  type EngineWindow,
  type ExistingBooking,
} from "./availability-engine";

// =============================================================================
// TYPES
// =============================================================================

export type CapacityMode = "theoretical" | "real_day";

export interface ComputeCapacityPreviewInput {
  /** YYYY-MM-DD calendar date in the tenant's timezone. */
  date: string;
  /** IANA timezone. */
  tenantTimezone: string;

  /** Effective working windows for the date (HH:mm in tenant tz). */
  windows: ReadonlyArray<EngineWindow>;
  /** Effective breaks for the date (HH:mm in tenant tz). */
  breaks: ReadonlyArray<EngineBreak>;

  /** Resolved slot duration (rule override → tenant default). */
  slotDurationMinutes: number;
  /** Service duration (customer-facing). */
  serviceDurationMinutes: number;
  /** Buffer subtracted from customer start when computing the blocked range. */
  bufferBeforeMinutes: number;
  /** Buffer added to customer end when computing the blocked range. */
  bufferAfterMinutes: number;

  mode: CapacityMode;
  /**
   * Active bookings for that staff/date. Required for `real_day`; ignored
   * for `theoretical`. `startAt`/`endAt` are buffer-inclusive UTC ISO.
   */
  existingBookings?: ReadonlyArray<ExistingBooking>;
}

export interface InvalidStartTime {
  time: string; // HH:mm
  reason: string; // human-readable
}

export interface CapacityPreviewResult {
  workingMinutes: number;
  breakMinutes: number;
  netBookableMinutes: number;
  slotDurationMinutes: number;
  serviceDurationMinutes: number;
  possibleStartTimes: string[];
  validStartTimes: string[];
  invalidStartTimes: InvalidStartTime[];
  maxNonOverlappingBookings: number;
  warnings: string[];
  suggestions: string[];
}

// =============================================================================
// CORE FUNCTION
// =============================================================================

export function computeCapacityPreview(
  input: ComputeCapacityPreviewInput,
): CapacityPreviewResult {
  const {
    windows,
    breaks,
    slotDurationMinutes,
    serviceDurationMinutes,
    bufferBeforeMinutes,
    bufferAfterMinutes,
    mode,
    existingBookings = [],
  } = input;

  // Project everything into minutes-since-midnight (tenant TZ).
  const windowsMin = windows.map((w) => toMinuteRange(w.startTime, w.endTime));
  const breaksMin = breaks.map((b) => toMinuteRange(b.startTime, b.endTime));
  const bookingsMin =
    mode === "real_day"
      ? existingBookings.map((b) =>
          bookingToLocalMinuteRange(b, input.date, input.tenantTimezone),
        )
      : [];

  // ---------------------------------------------------------------------------
  // workingMinutes / breakMinutes / netBookableMinutes
  // ---------------------------------------------------------------------------
  const workingMinutes = windowsMin.reduce(
    (acc, [s, e]) => acc + (e - s),
    0,
  );
  // Only count break time that INTERSECTS a working window — breaks scheduled
  // outside hours don't reduce bookable time (they wouldn't have been
  // bookable anyway).
  const breakMinutes = sumIntersection(windowsMin, breaksMin);
  // For real_day, existing bookings also subtract from net (but capped to
  // their window overlap).
  const bookingMinutes =
    mode === "real_day" ? sumIntersection(windowsMin, bookingsMin) : 0;
  const netBookableMinutes = Math.max(
    0,
    workingMinutes - breakMinutes - bookingMinutes,
  );

  // ---------------------------------------------------------------------------
  // possibleStartTimes / validStartTimes / invalidStartTimes
  // (REUSE Step 9 — don't duplicate the rules)
  // ---------------------------------------------------------------------------
  const engineInput: ComputeAvailableSlotsInput = {
    date: input.date,
    tenantTimezone: input.tenantTimezone,
    windows,
    breaks,
    serviceDurationMinutes,
    bufferBeforeMinutes,
    bufferAfterMinutes,
    slotDurationMinutes,
    existingBookings: mode === "real_day" ? existingBookings : [],
    // Capacity preview is admin-side; lead time and "future date" guards
    // don't apply. Pin `now` to the start of the requested day in UTC,
    // disable lead time, push max-days-ahead far enough that any date
    // within ~270 years passes.
    minLeadTimeMinutes: 0,
    maxDaysAhead: 365 * 100,
    now: new Date(`${input.date}T00:00:00Z`),
    preview: true,
  };
  const engineResult = computeAvailableSlots(engineInput);
  const validStartTimes = engineResult.slots.map((s) => s.displayTime);
  const invalidStartTimes = (engineResult.rejected ?? [])
    .filter((r) => r.time !== "*")
    .map<InvalidStartTime>((r) => ({
      time: r.time,
      reason: reasonToText(r.reason, breaks, windows),
    }));
  const possibleStartTimes = [
    ...new Set([...validStartTimes, ...invalidStartTimes.map((r) => r.time)]),
  ].sort();

  // ---------------------------------------------------------------------------
  // maxNonOverlappingBookings (packing)
  // ---------------------------------------------------------------------------
  const blockLength =
    serviceDurationMinutes + bufferBeforeMinutes + bufferAfterMinutes;
  const subtractors = [...breaksMin, ...bookingsMin];
  let maxNonOverlappingBookings = 0;
  let unusedMinutes = 0;
  for (const [ws, we] of windowsMin) {
    const free = subtractIntervals([ws, we], subtractors);
    for (const [fs, fe] of free) {
      const len = fe - fs;
      const fit = blockLength > 0 ? Math.floor(len / blockLength) : 0;
      maxNonOverlappingBookings += fit;
      unusedMinutes += len - fit * blockLength;
    }
  }

  // ---------------------------------------------------------------------------
  // warnings + suggestions
  // ---------------------------------------------------------------------------
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Per-invalid-slot lines first.
  for (const inv of invalidStartTimes) {
    warnings.push(`A booking starting at ${inv.time} ${inv.reason}.`);
  }
  if (
    invalidStartTimes.some(
      (r) => r.reason.startsWith("cannot fit") || r.reason.includes("ends at"),
    )
  ) {
    warnings.push(
      "Some generated start times cannot fit the full service duration.",
    );
  }
  if (serviceDurationMinutes % slotDurationMinutes !== 0) {
    warnings.push(
      "The service duration does not align perfectly with the slot duration.",
    );
    // Suggest the service duration as the slot grid — guaranteed alignment.
    suggestions.push(
      `Use a ${serviceDurationMinutes}-minute slot duration to align with this ${serviceDurationMinutes}-minute service.`,
    );
  }
  if (unusedMinutes > 0) {
    warnings.push(
      `There is unused time at the end of the working day (${unusedMinutes} minute${unusedMinutes === 1 ? "" : "s"}).`,
    );
  }

  return {
    workingMinutes,
    breakMinutes,
    netBookableMinutes,
    slotDurationMinutes,
    serviceDurationMinutes,
    possibleStartTimes,
    validStartTimes,
    invalidStartTimes,
    maxNonOverlappingBookings,
    warnings,
    suggestions,
  };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function toMinuteRange(start: string, end: string): [number, number] {
  return [toMin(start), toMin(end)];
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/**
 * Convert a UTC-ISO booking to (start, end) minutes-since-midnight in the
 * tenant's timezone, clipped to [0, 1440]. Bookings that don't intersect the
 * requested date at all collapse to an empty range and are filtered later
 * by the subtraction code.
 */
function bookingToLocalMinuteRange(
  b: ExistingBooking,
  date: string,
  zone: string,
): [number, number] {
  const startDt = DateTime.fromISO(b.startAt, { zone: "utc" }).setZone(zone);
  const endDt = DateTime.fromISO(b.endAt, { zone: "utc" }).setZone(zone);
  const dayStart = DateTime.fromObject(
    {
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
    },
    { zone },
  );
  const startMin = clamp01440(startDt.diff(dayStart).as("minutes"));
  const endMin = clamp01440(endDt.diff(dayStart).as("minutes"));
  // Order-safe — degenerate ranges (start>=end) are dropped downstream.
  return [startMin, Math.max(startMin, endMin)];
}

function clamp01440(n: number): number {
  return Math.max(0, Math.min(24 * 60, n));
}

/**
 * Sum the lengths of `subtractors` clipped to the union of `containers`.
 * Used for breakMinutes and bookingMinutes — both should only count time
 * that falls inside working windows.
 */
function sumIntersection(
  containers: ReadonlyArray<[number, number]>,
  subtractors: ReadonlyArray<[number, number]>,
): number {
  let total = 0;
  for (const [cs, ce] of containers) {
    for (const [ss, se] of subtractors) {
      const a = Math.max(cs, ss);
      const b = Math.min(ce, se);
      if (b > a) total += b - a;
    }
  }
  return total;
}

/**
 * Subtract a set of intervals from a single base range, returning the
 * uncovered sub-ranges. Used by both the packing math and the unused-time
 * computation.
 */
function subtractIntervals(
  base: [number, number],
  subtractors: ReadonlyArray<[number, number]>,
): Array<[number, number]> {
  const result: Array<[number, number]> = [];
  // Sort + merge subtractors so we walk left to right once.
  const sorted = [...subtractors]
    .map(([s, e]): [number, number] => [
      Math.max(s, base[0]),
      Math.min(e, base[1]),
    ])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  let cursor = base[0];
  for (const [s, e] of sorted) {
    if (s > cursor) result.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < base[1]) result.push([cursor, base[1]]);
  return result;
}

function reasonToText(
  code: string,
  breaks: ReadonlyArray<EngineBreak>,
  windows: ReadonlyArray<EngineWindow>,
): string {
  switch (code) {
    case "overlaps_break": {
      // Best-effort: name the first break for the message; admins iterate
      // anyway when multiple are configured.
      const b = breaks[0];
      return b
        ? `would overlap the configured break (${b.startTime}–${b.endTime})`
        : "would overlap a configured break";
    }
    case "exceeds_working_window": {
      const w = windows[windows.length - 1];
      return w
        ? `cannot fit because the working day ends at ${w.endTime}`
        : "cannot fit because the working day ends";
    }
    case "overlaps_booking":
      return "would overlap an existing booking";
    case "lead_time":
      return "is before the minimum booking lead time";
    default:
      return code;
  }
}
