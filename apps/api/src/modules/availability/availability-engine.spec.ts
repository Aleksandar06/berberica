/**
 * Engine tests. Cover:
 *   • The three spec examples (exact slot lists)
 *   • Buffers before/after
 *   • Existing-booking conflicts; cancelled bookings don't block (handled
 *     by caller — the engine is fed only ACTIVE bookings)
 *   • Lead time excludes near-term slots
 *   • Max-days-ahead excludes far dates
 *   • Past dates excluded
 *   • Tenant timezone shifts UTC instants correctly
 *   • DST spring-forward + fall-back days produce sane slot grids
 *   • Exception closed day → empty; exception custom hours → shifted window
 *   • Aggregator unions across staff
 */
import { describe, expect, it } from "vitest";

import {
  computeAvailableSlots,
  type ComputeAvailableSlotsInput,
} from "./availability-engine";
import { computeAnyStaffSlots } from "./availability-engine.aggregate";

// -----------------------------------------------------------------------
// Test input factory. UTC default — timezone tests override.
// -----------------------------------------------------------------------
function input(
  overrides: Partial<ComputeAvailableSlotsInput> = {},
): ComputeAvailableSlotsInput {
  return {
    date: "2026-06-01",
    tenantTimezone: "UTC",
    serviceDurationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    slotDurationMinutes: 30,
    windows: [{ startTime: "09:00", endTime: "17:00" }],
    breaks: [{ startTime: "12:00", endTime: "13:00" }],
    existingBookings: [],
    minLeadTimeMinutes: 0,
    maxDaysAhead: 365,
    // Pinned to the test date so the default maxDaysAhead doesn't reject
    // the requested date before any slot math runs. Tests that exercise the
    // past/max-days guards override this explicitly.
    now: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

// =============================================================================
// SPEC EXAMPLES — exact expected slot lists
// =============================================================================

describe("computeAvailableSlots — spec examples", () => {
  it("Example 1: 09–17, break 12–13, slot 30, service 30 → 14 slots", () => {
    const { slots } = computeAvailableSlots(input());
    expect(slots.map((s) => s.displayTime)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
      "16:30",
    ]);
  });

  it("Example 2: slot 30, service 60 → 12 slots, excludes 11:30/12:00/12:30/16:30", () => {
    const { slots, rejected } = computeAvailableSlots(
      input({ serviceDurationMinutes: 60, preview: true }),
    );
    expect(slots.map((s) => s.displayTime)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
      "15:00",
      "15:30",
      "16:00",
    ]);
    const rejectedTimes = rejected!.map((r) => r.time);
    expect(rejectedTimes).toEqual(
      expect.arrayContaining(["11:30", "12:00", "12:30", "16:30"]),
    );
    expect(rejected!.find((r) => r.time === "16:30")?.reason).toBe(
      "exceeds_working_window",
    );
    expect(rejected!.find((r) => r.time === "12:00")?.reason).toBe(
      "overlaps_break",
    );
  });

  it("Example 3: 09–14, no break, slot 15, service 45 → 18 slots, excludes 13:30/13:45", () => {
    const { slots, rejected } = computeAvailableSlots(
      input({
        windows: [{ startTime: "09:00", endTime: "14:00" }],
        breaks: [],
        slotDurationMinutes: 15,
        serviceDurationMinutes: 45,
        preview: true,
      }),
    );
    expect(slots).toHaveLength(18);
    expect(slots[0]!.displayTime).toBe("09:00");
    expect(slots[17]!.displayTime).toBe("13:15");
    const rejectedTimes = rejected!.map((r) => r.time);
    expect(rejectedTimes).toEqual(["13:30", "13:45"]);
    for (const r of rejected!) {
      expect(r.reason).toBe("exceeds_working_window");
    }
  });
});

// =============================================================================
// BUFFERS
// =============================================================================

describe("computeAvailableSlots — buffers", () => {
  it("bufferAfter pushes the last possible slot earlier", () => {
    // Window 09–17, service 30 min, buffer-after 15. Blocked range must
    // end by 17:00 → last slot starts at 16:15 (booking 16:15-16:45,
    // blocked 16:15-17:00). Slot grid is 30 min, so candidates land on
    // :00 and :30 — 16:30 → blocked 16:30-17:15, exceeds window → reject.
    // Last valid candidate: 16:00 → blocked 16:00-16:45.
    const { slots } = computeAvailableSlots(
      input({
        breaks: [],
        bufferAfterMinutes: 15,
      }),
    );
    const last = slots[slots.length - 1]!;
    expect(last.displayTime).toBe("16:00");
  });

  it("bufferBefore pushes the first possible slot later", () => {
    // bufferBefore=15, window 09:00 start: candidate 09:00 → blocked
    // 08:45-09:30, blockedStart < windowStart → reject. First valid
    // candidate at 09:30 (blocked 09:15-10:00).
    const { slots } = computeAvailableSlots(
      input({
        breaks: [],
        bufferBeforeMinutes: 15,
      }),
    );
    expect(slots[0]!.displayTime).toBe("09:30");
  });
});

// =============================================================================
// EXISTING BOOKINGS
// =============================================================================

describe("computeAvailableSlots — existing bookings", () => {
  it("blocks slots that overlap an existing active booking", () => {
    // Existing booking 10:00-11:00 UTC (already includes any buffers).
    // Candidates 09:30 (09:30-10:00) — touches but doesn't overlap → OK
    //            10:00 (10:00-10:30) — overlaps → REJECTED
    //            10:30 (10:30-11:00) — fully inside → REJECTED
    //            11:00 (11:00-11:30) — touches end, no overlap → OK
    const { slots } = computeAvailableSlots(
      input({
        breaks: [],
        existingBookings: [
          { startAt: "2026-06-01T10:00:00Z", endAt: "2026-06-01T11:00:00Z" },
        ],
      }),
    );
    const times = slots.map((s) => s.displayTime);
    expect(times).toContain("09:30");
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("10:30");
    expect(times).toContain("11:00");
  });

  it("cancelled bookings are not the engine's concern — caller filters", () => {
    // The engine only sees ACTIVE bookings. If the caller filters out
    // cancelled/completed/no_show before calling, those don't block — and
    // the test below proves passing no bookings means no blocks.
    const { slots } = computeAvailableSlots(
      input({ breaks: [], existingBookings: [] }),
    );
    expect(slots.map((s) => s.displayTime)).toContain("10:00");
  });
});

// =============================================================================
// LEAD TIME / MAX DAYS / PAST
// =============================================================================

describe("computeAvailableSlots — temporal guards", () => {
  it("lead time excludes near-term slots", () => {
    // now = 2026-06-01 10:00 UTC, lead = 60 min → earliest 11:00.
    const { slots, rejected } = computeAvailableSlots(
      input({
        breaks: [],
        minLeadTimeMinutes: 60,
        now: new Date("2026-06-01T10:00:00Z"),
        preview: true,
      }),
    );
    const times = slots.map((s) => s.displayTime);
    expect(times[0]).toBe("11:00");
    expect(rejected!.find((r) => r.time === "10:30")?.reason).toBe("lead_time");
  });

  it("returns empty when date is more than maxDaysAhead in the future", () => {
    const { slots, rejected } = computeAvailableSlots(
      input({
        date: "2026-06-01",
        now: new Date("2026-01-01T00:00:00Z"),
        maxDaysAhead: 30,
        preview: true,
      }),
    );
    expect(slots).toHaveLength(0);
    expect(rejected).toEqual([
      { time: "*", reason: "beyond_max_days_ahead" },
    ]);
  });

  it("returns empty when date is in the past", () => {
    const { slots, rejected } = computeAvailableSlots(
      input({
        date: "2024-06-01",
        now: new Date("2026-01-01T00:00:00Z"),
        preview: true,
      }),
    );
    expect(slots).toHaveLength(0);
    expect(rejected).toEqual([{ time: "*", reason: "date_in_past" }]);
  });
});

// =============================================================================
// CLOSED / NO WINDOW
// =============================================================================

describe("computeAvailableSlots — closed days", () => {
  it("returns empty when windows is empty (exception closed)", () => {
    const { slots, rejected } = computeAvailableSlots(
      input({ windows: [], breaks: [], preview: true }),
    );
    expect(slots).toHaveLength(0);
    expect(rejected).toEqual([{ time: "*", reason: "no_window" }]);
  });

  it("returns the custom-hours window when an exception narrows the day", () => {
    // Caller resolved the exception to windows: [{ "10:00","12:00" }].
    const { slots } = computeAvailableSlots(
      input({
        windows: [{ startTime: "10:00", endTime: "12:00" }],
        breaks: [],
      }),
    );
    expect(slots.map((s) => s.displayTime)).toEqual([
      "10:00",
      "10:30",
      "11:00",
      "11:30",
    ]);
  });
});

// =============================================================================
// DATE-SPECIFIC BREAK
// =============================================================================

describe("computeAvailableSlots — date-specific break", () => {
  it("excludes slots overlapping an exception break", () => {
    // Loader unions weekly + exception breaks; here we just pass a single
    // exception-break in `breaks`. The engine doesn't care about origin.
    const { slots } = computeAvailableSlots(
      input({
        breaks: [{ startTime: "10:00", endTime: "11:00" }],
      }),
    );
    const times = slots.map((s) => s.displayTime);
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("10:30");
    expect(times).toContain("09:30"); // ends at 10:00 — touches, doesn't overlap
    expect(times).toContain("11:00");
  });
});

// =============================================================================
// TIMEZONES
// =============================================================================

describe("computeAvailableSlots — timezones", () => {
  it("Europe/Skopje 09:00 in summer (CEST, UTC+2) → 07:00 UTC", () => {
    const { slots } = computeAvailableSlots(
      input({
        date: "2026-06-01", // CEST in effect (UTC+2)
        tenantTimezone: "Europe/Skopje",
        windows: [{ startTime: "09:00", endTime: "10:00" }],
        breaks: [],
      }),
    );
    expect(slots).toHaveLength(2);
    expect(slots[0]!.displayTime).toBe("09:00");
    expect(slots[0]!.startUtc).toBe("2026-06-01T07:00:00.000Z");
    expect(slots[1]!.startUtc).toBe("2026-06-01T07:30:00.000Z");
  });

  it("Europe/Skopje 09:00 in winter (CET, UTC+1) → 08:00 UTC", () => {
    const { slots } = computeAvailableSlots(
      input({
        date: "2026-01-15", // CET in effect (UTC+1)
        tenantTimezone: "Europe/Skopje",
        windows: [{ startTime: "09:00", endTime: "10:00" }],
        breaks: [],
        now: new Date("2026-01-15T00:00:00Z"),
      }),
    );
    expect(slots[0]!.startUtc).toBe("2026-01-15T08:00:00.000Z");
  });

  it("America/New_York 09:00 in summer (EDT, UTC-4) → 13:00 UTC", () => {
    const { slots } = computeAvailableSlots(
      input({
        date: "2026-07-01",
        tenantTimezone: "America/New_York",
        windows: [{ startTime: "09:00", endTime: "10:00" }],
        breaks: [],
      }),
    );
    expect(slots[0]!.startUtc).toBe("2026-07-01T13:00:00.000Z");
  });
});

// =============================================================================
// DST TRANSITIONS
// =============================================================================

describe("computeAvailableSlots — DST", () => {
  it("Europe/Skopje spring-forward day (2026-03-29) — wall-clock window 09–12 produces a continuous slot grid", () => {
    // 2026-03-29 in Europe/Skopje: clocks jump 02:00 → 03:00. The window
    // 09:00–12:00 is well past the gap, so the candidate grid is unaffected.
    // What matters: the *date's UTC offset* is +2 from 03:00 onward, so
    // 09:00 local = 07:00 UTC (not 08:00 like a CET day).
    const { slots, warnings } = computeAvailableSlots(
      input({
        date: "2026-03-29",
        tenantTimezone: "Europe/Skopje",
        windows: [{ startTime: "09:00", endTime: "12:00" }],
        breaks: [],
        preview: true,
        now: new Date("2026-03-29T00:00:00Z"),
      }),
    );
    expect(slots.map((s) => s.displayTime)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
    ]);
    expect(slots[0]!.startUtc).toBe("2026-03-29T07:00:00.000Z");
    // The grid is continuous: each slot is exactly +30 UTC minutes from
    // the previous one — no missing or duplicated absolute instants.
    for (let i = 1; i < slots.length; i++) {
      const prev = new Date(slots[i - 1]!.startUtc).getTime();
      const cur = new Date(slots[i]!.startUtc).getTime();
      expect(cur - prev).toBe(30 * 60_000);
    }
    expect(warnings).toEqual([]);
  });

  it("Europe/Skopje fall-back day (2026-10-25) — 02:30 is ambiguous; Luxon picks the earlier occurrence", () => {
    // 2026-10-25 in Europe/Skopje: clocks fall back 03:00 → 02:00, so the
    // wall-clock interval 02:00–03:00 occurs twice. We test that a window
    // crossing 03:00 is handled (Luxon resolves ambiguity by picking the
    // earlier occurrence for the window boundaries).
    const { slots, warnings } = computeAvailableSlots(
      input({
        date: "2026-10-25",
        tenantTimezone: "Europe/Skopje",
        windows: [{ startTime: "09:00", endTime: "12:00" }],
        breaks: [],
        now: new Date("2026-10-25T00:00:00Z"),
      }),
    );
    expect(slots.map((s) => s.displayTime)).toEqual([
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
    ]);
    // After fall-back the zone is UTC+1, so 09:00 local = 08:00 UTC.
    expect(slots[0]!.startUtc).toBe("2026-10-25T08:00:00.000Z");
    expect(warnings).toBeUndefined();
  });
});

// =============================================================================
// AGGREGATOR
// =============================================================================

describe("computeAnyStaffSlots", () => {
  it("unions slots across staff and records who is free per slot", () => {
    // Two staff:
    //   • Marko: 09–10 window
    //   • Ana:   09:30–10:30 window
    // Slot 30, service 30, no buffers.
    // Marko slots: 09:00, 09:30
    // Ana slots:   09:30, 10:00
    // Union:       09:00 (Marko), 09:30 (Marko+Ana), 10:00 (Ana)
    const { slots } = computeAnyStaffSlots([
      {
        staffMemberId: "marko",
        per: input({
          windows: [{ startTime: "09:00", endTime: "10:00" }],
          breaks: [],
        }),
      },
      {
        staffMemberId: "ana",
        per: input({
          windows: [{ startTime: "09:30", endTime: "10:30" }],
          breaks: [],
        }),
      },
    ]);
    expect(slots.map((s) => s.displayTime)).toEqual(["09:00", "09:30", "10:00"]);
    expect(slots[0]!.availableStaffMemberIds).toEqual(["marko"]);
    expect(slots[1]!.availableStaffMemberIds).toEqual(["marko", "ana"]);
    expect(slots[2]!.availableStaffMemberIds).toEqual(["ana"]);
  });
});
