/**
 * =============================================================================
 *  AVAILABILITY SLOT ENGINE — pure, deterministic, DST-safe
 * =============================================================================
 *
 *  Step 9 of the build. Computes the list of bookable slots for one
 *  (tenant, staff, service, date) given the inputs from:
 *    • Step 8 loader        → windows[] + breaks[] for the date
 *    • Step 11 booking read → existing active bookings for that staff/date
 *    • Tenant settings      → minLeadTimeMinutes, maxDaysAhead
 *
 *  Design contract:
 *    • PURE function. Same inputs → same outputs. `now` is injectable.
 *    • No HTTP, no Prisma, no env reads. Test the algorithm in isolation.
 *    • Wall-clock config (windows, breaks) is interpreted in the tenant's
 *      IANA timezone. Iteration runs in UTC so DST transitions don't shift
 *      the candidate grid mid-day.
 *    • Output `startUtc`/`endUtc` are the *customer-facing* booking times.
 *      Buffer-inclusive blocked ranges are computed internally for
 *      collision checks but are NEVER returned — Step 11 derives the
 *      `bookings.start_at/end_at` (which DO include buffers) from the
 *      service's buffer columns plus the slot's customer times.
 *
 *  Booking time convention (matches Step 2 schema):
 *      customer_start  = slot.startUtc
 *      customer_end    = slot.endUtc                       (= customer_start + serviceDuration)
 *      blocked_start   = customer_start - bufferBefore
 *      blocked_end     = customer_end   + bufferAfter
 *
 *  Half-open semantics for ALL intervals — both ours and Luxon's. A booking
 *  ending exactly at the window/break edge is considered NOT overlapping
 *  the next interval. Consistent with the PostgreSQL `tstzrange '[)' && ...`
 *  exclusion constraint from Step 2.
 *
 *  DST handling:
 *    • Iteration is in UTC, so DST shifts within the working window do not
 *      double-count or skip slots. The candidate grid is continuous UTC.
 *    • If the window START wall-clock falls inside a spring-forward gap,
 *      Luxon shifts it forward by one hour — we add a warning when the
 *      reconstructed wall-clock doesn't match the requested time.
 *    • Fall-back (ambiguous wall-clock) → Luxon picks the earlier
 *      occurrence. Documented; tested.
 * =============================================================================
 */

import { DateTime, Interval } from "luxon";

// =============================================================================
// TYPES
// =============================================================================

export interface ComputeAvailableSlotsInput {
  /** YYYY-MM-DD calendar date in the tenant's timezone. */
  date: string;
  /** IANA timezone, e.g. "Europe/Skopje". */
  tenantTimezone: string;

  /** Customer-facing service duration in minutes. */
  serviceDurationMinutes: number;
  /** Buffer subtracted from customer start to compute the blocked range. */
  bufferBeforeMinutes: number;
  /** Buffer added to customer end to compute the blocked range. */
  bufferAfterMinutes: number;

  /**
   * Slot grid duration. The caller is expected to have already resolved
   * "availability rule override → tenant default" before calling. The
   * engine never reads tenant settings.
   */
  slotDurationMinutes: number;

  /**
   * Effective working windows for the date, in tenant-local wall-clock
   * HH:mm. Sourced from `AvailabilityLoaderService` per the Step 8
   * precedence contract.
   */
  windows: ReadonlyArray<EngineWindow>;
  /** Effective breaks for the date, in tenant-local wall-clock HH:mm. */
  breaks: ReadonlyArray<EngineBreak>;

  /**
   * Active bookings for this staff on this date. `startAt`/`endAt` are the
   * BLOCKED RANGE (already buffer-inclusive per Step 2 schema). Pass as
   * ISO 8601 strings — the engine parses to UTC.
   */
  existingBookings: ReadonlyArray<ExistingBooking>;

  /** Tenant policy: bookings must start at least this many minutes after `now`. */
  minLeadTimeMinutes: number;
  /** Tenant policy: bookings must be no more than this many days after "today". */
  maxDaysAhead: number;

  /** Injectable for tests. Defaults to `new Date()`. */
  now?: Date;
  /** When true, include `rejected` + `warnings` arrays in the result. */
  preview?: boolean;
}

export interface EngineWindow {
  startTime: string; // "HH:mm"
  endTime: string;
}
export interface EngineBreak {
  startTime: string;
  endTime: string;
}
export interface ExistingBooking {
  startAt: string; // ISO 8601 UTC
  endAt: string;
}

export interface AvailableSlot {
  /** Customer-facing start, ISO 8601 UTC. */
  startUtc: string;
  /** Customer-facing end (= start + serviceDuration), ISO 8601 UTC. */
  endUtc: string;
  /** "HH:mm" wall-clock start in the tenant timezone. */
  displayTime: string;
}

export type RejectionReason =
  | "date_in_past"
  | "beyond_max_days_ahead"
  | "no_window"
  | "exceeds_working_window"
  | "lead_time"
  | "overlaps_break"
  | "overlaps_booking";

export interface RejectedCandidate {
  /** "HH:mm" wall-clock; "*" for whole-date rejections. */
  time: string;
  reason: RejectionReason;
}

export interface ComputeAvailableSlotsResult {
  slots: AvailableSlot[];
  rejected?: RejectedCandidate[];
  warnings?: string[];
}

// =============================================================================
// CORE FUNCTION
// =============================================================================

export function computeAvailableSlots(
  input: ComputeAvailableSlotsInput,
): ComputeAvailableSlotsResult {
  const slots: AvailableSlot[] = [];
  const rejected: RejectedCandidate[] = [];
  const warnings: string[] = [];

  const zone = input.tenantTimezone;
  const now = DateTime.fromJSDate(input.now ?? new Date()).setZone(zone);
  const today = now.startOf("day");

  // Anchor the requested date in the tenant timezone so the past / max-days
  // checks are against the tenant's calendar, not UTC's.
  const requestedDate = parseDateInZone(input.date, zone);

  // -----------------------------------------------------------------------
  // Whole-date guards
  // -----------------------------------------------------------------------
  if (+requestedDate < +today) {
    if (input.preview) rejected.push({ time: "*", reason: "date_in_past" });
    return finalize(slots, rejected, warnings, input.preview);
  }
  const maxDate = today.plus({ days: input.maxDaysAhead });
  if (+requestedDate > +maxDate) {
    if (input.preview)
      rejected.push({ time: "*", reason: "beyond_max_days_ahead" });
    return finalize(slots, rejected, warnings, input.preview);
  }
  if (input.windows.length === 0) {
    if (input.preview) rejected.push({ time: "*", reason: "no_window" });
    return finalize(slots, rejected, warnings, input.preview);
  }

  // -----------------------------------------------------------------------
  // Pre-compute UTC Intervals for the breaks + existing bookings.
  // -----------------------------------------------------------------------
  const breakIntervals = input.breaks.map((b) =>
    Interval.fromDateTimes(
      anchorWallClock(input.date, b.startTime, zone),
      anchorWallClock(input.date, b.endTime, zone),
    ),
  );
  const bookingIntervals = input.existingBookings.map((b) =>
    Interval.fromDateTimes(
      DateTime.fromISO(b.startAt, { zone: "utc" }),
      DateTime.fromISO(b.endAt, { zone: "utc" }),
    ),
  );

  const earliestStart = now.plus({ minutes: input.minLeadTimeMinutes });

  // -----------------------------------------------------------------------
  // Iterate each window. Iteration runs in UTC (Luxon DateTime is an
  // absolute instant); the wall-clock display is derived per slot via
  // setZone, so DST shifts inside a single window produce a continuous
  // grid of absolute times rather than a broken wall-clock sequence.
  // -----------------------------------------------------------------------
  for (const w of input.windows) {
    const windowStart = anchorWallClock(input.date, w.startTime, zone);
    const windowEnd = anchorWallClock(input.date, w.endTime, zone);

    if (!windowStart.isValid || !windowEnd.isValid) {
      warnings.push(
        `Invalid window ${w.startTime}-${w.endTime} on ${input.date} (${zone}): ${windowStart.invalidReason ?? windowEnd.invalidReason}`,
      );
      continue;
    }

    // DST sanity: did Luxon shift our requested wall-clock time?
    const startEcho = windowStart.setZone(zone).toFormat("HH:mm");
    if (startEcho !== w.startTime) {
      warnings.push(
        `DST adjusted window start ${w.startTime} → ${startEcho} on ${input.date} (${zone})`,
      );
    }
    const endEcho = windowEnd.setZone(zone).toFormat("HH:mm");
    if (endEcho !== w.endTime) {
      warnings.push(
        `DST adjusted window end ${w.endTime} → ${endEcho} on ${input.date} (${zone})`,
      );
    }

    let cursor = windowStart;
    // Loop while the customer-facing START is strictly inside the window.
    // A candidate where customerStart == windowEnd is past close; skip.
    while (+cursor < +windowEnd) {
      const customerStart = cursor;
      const customerEnd = customerStart.plus({
        minutes: input.serviceDurationMinutes,
      });
      const blockedStart = customerStart.minus({
        minutes: input.bufferBeforeMinutes,
      });
      const blockedEnd = customerEnd.plus({
        minutes: input.bufferAfterMinutes,
      });
      const displayTime = customerStart.setZone(zone).toFormat("HH:mm");
      const candidateInterval = Interval.fromDateTimes(blockedStart, blockedEnd);

      // Guard 1: blocked range must fit fully inside the window.
      if (+blockedStart < +windowStart || +blockedEnd > +windowEnd) {
        if (input.preview)
          rejected.push({ time: displayTime, reason: "exceeds_working_window" });
        cursor = cursor.plus({ minutes: input.slotDurationMinutes });
        continue;
      }

      // Guard 2: lead time (anchored to `now` in the tenant TZ).
      if (+customerStart < +earliestStart) {
        if (input.preview)
          rejected.push({ time: displayTime, reason: "lead_time" });
        cursor = cursor.plus({ minutes: input.slotDurationMinutes });
        continue;
      }

      // Guard 3: overlaps any effective break?
      if (breakIntervals.some((bi) => bi.overlaps(candidateInterval))) {
        if (input.preview)
          rejected.push({ time: displayTime, reason: "overlaps_break" });
        cursor = cursor.plus({ minutes: input.slotDurationMinutes });
        continue;
      }

      // Guard 4: overlaps any existing active booking?
      if (bookingIntervals.some((bi) => bi.overlaps(candidateInterval))) {
        if (input.preview)
          rejected.push({ time: displayTime, reason: "overlaps_booking" });
        cursor = cursor.plus({ minutes: input.slotDurationMinutes });
        continue;
      }

      // Accept.
      slots.push({
        startUtc: customerStart.toUTC().toISO()!,
        endUtc: customerEnd.toUTC().toISO()!,
        displayTime,
      });
      cursor = cursor.plus({ minutes: input.slotDurationMinutes });
    }
  }

  return finalize(slots, rejected, warnings, input.preview);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse a YYYY-MM-DD date string anchored at midnight in the given IANA zone.
 * We don't use DateTime.fromISO("YYYY-MM-DD", { zone }) because it
 * interprets the string as UTC and then shifts — which is wrong for dates
 * straddling timezone offsets.
 */
function parseDateInZone(date: string, zone: string): DateTime {
  return DateTime.fromObject(
    {
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
    },
    { zone },
  );
}

/**
 * Anchor a wall-clock HH:mm time on a YYYY-MM-DD date to a real absolute
 * instant (DateTime in UTC) by way of the tenant zone. Luxon handles DST
 * boundary disambiguation automatically.
 */
function anchorWallClock(
  date: string,
  time: string,
  zone: string,
): DateTime {
  const [hh, mm] = time.split(":").map(Number) as [number, number];
  return DateTime.fromObject(
    {
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
      hour: hh,
      minute: mm,
    },
    { zone },
  );
}

function finalize(
  slots: AvailableSlot[],
  rejected: RejectedCandidate[],
  warnings: string[],
  preview?: boolean,
): ComputeAvailableSlotsResult {
  if (!preview) return { slots };
  return { slots, rejected, warnings };
}
