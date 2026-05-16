import { Injectable } from "@nestjs/common";

import { TenantValidatorService } from "../../common/services/tenant-validator.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  dateStringToDate,
  dateToTimeString,
} from "./availability-config.service";

/**
 * =============================================================================
 *  AVAILABILITY RESOLUTION CONTRACT  (the precedence rules Step 9 relies on)
 * =============================================================================
 *
 *  For a given (tenant, staffMember, date) the engine resolves a
 *  `ResolvedAvailability` by walking these steps in order. Step 9's slot
 *  computation takes the result as-is — it does NOT re-query availability_*.
 *
 *  WORKING HOURS (one resolution wins for the whole date):
 *
 *    1. Staff-specific date EXCEPTION (tenant_id, staff_member_id, date)
 *         • isClosed=true  → no availability (windows = [])
 *         • custom hours   → single window [custom_start, custom_end]
 *         • source = "exception_staff"
 *
 *    2. Tenant-wide date EXCEPTION (tenant_id, staff_member_id IS NULL, date)
 *         • same handling as (1), source = "exception_tenant"
 *
 *    3. Staff-specific WEEKLY rules (tenant, staff, day_of_week, is_active)
 *         • If any exist, use ALL of them (a staff member can have multiple
 *           non-overlapping windows for the same day, e.g. 09–12 then 14–18).
 *         • source = "rules_staff"
 *
 *    4. Tenant-wide WEEKLY rules (tenant, staff_member_id IS NULL, day_of_week)
 *         • Same handling as (3), source = "rules_tenant"
 *
 *    5. Otherwise: no availability for that date. source = "none".
 *
 *  IMPORTANT — staff-specific OVERRIDES tenant-wide for hours. They do NOT
 *  union. If a staff member has even one staff-specific weekly rule for the
 *  day, the tenant-wide rules for that day are ignored *for that staff*.
 *  This lets admins say "tenant is open Mon–Sat, but Marko is part-time
 *  Mon/Wed/Fri" by adding only Mon/Wed/Fri staff-specific rules.
 *
 *
 *  BREAKS (combined, not overridden):
 *
 *    6. Weekly breaks: union of staff-specific AND tenant-wide breaks for
 *       the day_of_week. Both apply.
 *
 *    7. Exception breaks for the date: union of staff-specific AND
 *       tenant-wide. Both apply.
 *
 *    8. Final break list is deduped by (startTime, endTime) — identical
 *       breaks declared in both scopes collapse to one. Sorted by
 *       startTime ascending.
 *
 *  Breaks outside the resolved working window are PRESERVED in the result;
 *  the slot engine simply intersects them with the window. This matches
 *  the admin's intent — a 12–13 lunch break is still "13:00 work resumes"
 *  even on a half-day when the window is 09–12.
 *
 *  TIMEZONES: this loader returns wall-clock HH:mm strings only. Anchoring
 *  them to actual UTC instants (DST-aware) is Step 9's job.
 * =============================================================================
 */

export type AvailabilitySource =
  | "exception_staff"
  | "exception_tenant"
  | "rules_staff"
  | "rules_tenant"
  | "none";

export interface EffectiveWindow {
  /** "HH:mm" — wall-clock start in the tenant's timezone. */
  startTime: string;
  /** "HH:mm" — wall-clock end in the tenant's timezone. */
  endTime: string;
  /**
   * Per-rule slot-duration override, in minutes. Null = use tenant default
   * (TenantSettings.defaultSlotDurationMinutes). Exception-derived windows
   * always carry null.
   */
  slotDurationMinutes: number | null;
}

export interface EffectiveBreak {
  startTime: string;
  endTime: string;
}

export interface ResolvedAvailability {
  /** Echo of the requested date for caller convenience. */
  date: string;
  staffMemberId: string;
  /** True when the date resolves to "closed" via an exception. */
  isClosed: boolean;
  /** Working windows; empty when isClosed or when no rules match. */
  windows: EffectiveWindow[];
  /** Combined + deduped break list. */
  breaks: EffectiveBreak[];
  /** Free-text reason from the matched exception, when applicable. */
  reason: string | null;
  source: AvailabilitySource;
}

export interface LoadAvailabilityArgs {
  tenantId: string;
  staffMemberId: string;
  /** YYYY-MM-DD */
  date: string;
}

@Injectable()
export class AvailabilityLoaderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TenantValidatorService,
  ) {}

  async loadAvailabilityConfigForDate(
    args: LoadAvailabilityArgs,
  ): Promise<ResolvedAvailability> {
    const { tenantId, staffMemberId, date } = args;

    // Cross-tenant defense — same 404 contract as everywhere else.
    await this.validator.assertStaffBelongsToTenant(staffMemberId, tenantId);

    const exceptionDate = dateStringToDate(date);
    const dayOfWeek = computeDayOfWeekUtc(date);

    // -----------------------------------------------------------------------
    // Step 1+2: exceptions (staff-specific wins; fallback tenant-wide)
    // -----------------------------------------------------------------------
    const staffException = await this.prisma.availabilityException.findFirst({
      where: { tenantId, staffMemberId, exceptionDate },
    });
    const exception =
      staffException ??
      (await this.prisma.availabilityException.findFirst({
        where: { tenantId, staffMemberId: null, exceptionDate },
      }));

    let windows: EffectiveWindow[] = [];
    let isClosed = false;
    let reason: string | null = null;
    let source: AvailabilitySource = "none";

    if (exception) {
      reason = exception.reason ?? null;
      source = exception.staffMemberId ? "exception_staff" : "exception_tenant";
      if (exception.isClosed) {
        isClosed = true;
      } else if (exception.customStartTime && exception.customEndTime) {
        windows = [
          {
            startTime: dateToTimeString(exception.customStartTime),
            endTime: dateToTimeString(exception.customEndTime),
            slotDurationMinutes: null,
          },
        ];
      }
      // Else: open exception with no custom hours — falls through to no windows.
      // (The schema prevents this case from being created, but if a future
      // migration creates one, treat it as "no availability" rather than
      // crashing.)
    } else {
      // ---------------------------------------------------------------------
      // Step 3+4: weekly rules (staff-specific overrides tenant-wide)
      // ---------------------------------------------------------------------
      const staffRules = await this.prisma.availabilityRule.findMany({
        where: {
          tenantId,
          staffMemberId,
          dayOfWeek,
          isActive: true,
        },
        orderBy: { startTime: "asc" },
      });
      if (staffRules.length > 0) {
        windows = staffRules.map(toWindow);
        source = "rules_staff";
      } else {
        const tenantRules = await this.prisma.availabilityRule.findMany({
          where: {
            tenantId,
            staffMemberId: null,
            dayOfWeek,
            isActive: true,
          },
          orderBy: { startTime: "asc" },
        });
        if (tenantRules.length > 0) {
          windows = tenantRules.map(toWindow);
          source = "rules_tenant";
        }
      }
    }

    // -----------------------------------------------------------------------
    // Step 6+7+8: breaks (union of all applicable, deduped)
    // -----------------------------------------------------------------------
    const [weeklyBreaks, exceptionBreaks] = await Promise.all([
      this.prisma.availabilityBreak.findMany({
        where: {
          tenantId,
          dayOfWeek,
          isActive: true,
          OR: [{ staffMemberId }, { staffMemberId: null }],
        },
        orderBy: { startTime: "asc" },
      }),
      this.prisma.availabilityExceptionBreak.findMany({
        where: {
          tenantId,
          exceptionDate,
          OR: [{ staffMemberId }, { staffMemberId: null }],
        },
        orderBy: { startTime: "asc" },
      }),
    ]);

    const seen = new Set<string>();
    const breaks: EffectiveBreak[] = [];
    for (const b of [...weeklyBreaks, ...exceptionBreaks]) {
      const startTime = dateToTimeString(b.startTime);
      const endTime = dateToTimeString(b.endTime);
      const key = `${startTime}-${endTime}`;
      if (!seen.has(key)) {
        seen.add(key);
        breaks.push({ startTime, endTime });
      }
    }
    breaks.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
      date,
      staffMemberId,
      isClosed,
      windows,
      breaks,
      reason,
      source,
    };
  }
}

// ---------------------------------------------------------------------------

function toWindow(r: {
  startTime: Date;
  endTime: Date;
  slotDurationMinutes: number | null;
}): EffectiveWindow {
  return {
    startTime: dateToTimeString(r.startTime),
    endTime: dateToTimeString(r.endTime),
    slotDurationMinutes: r.slotDurationMinutes,
  };
}

/**
 * Day-of-week (0=Sun..6=Sat) for a YYYY-MM-DD date computed in UTC.
 * UTC is intentional: the date string IS a calendar date with no zone, and
 * we want a deterministic mapping. Step 9 may interpret the date in the
 * tenant's timezone for slot-instant math, but the weekly-rule lookup uses
 * the calendar day-of-week.
 */
function computeDayOfWeekUtc(s: string): number {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
