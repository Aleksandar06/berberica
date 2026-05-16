import { Injectable, NotFoundException } from "@nestjs/common";
import { DateTime } from "luxon";

import { TenantValidatorService } from "../../common/services/tenant-validator.service";
import { PrismaService } from "../../prisma/prisma.service";
import {
  type CapacityMode,
  type CapacityPreviewResult,
  computeCapacityPreview,
} from "./availability-capacity";
import type { ExistingBooking } from "./availability-engine";
import { AvailabilityLoaderService } from "./availability-loader.service";

export interface CapacityPreviewParams {
  tenantId: string;
  staffMemberId: string;
  serviceId: string;
  date: string;
  mode: CapacityMode;
}

/**
 * NestJS service that orchestrates the pure capacity engine:
 *   1. Validate staff/service belong to the resolved tenant (Step 7).
 *   2. Resolve effective availability for the date via Step 8 loader.
 *   3. Pick slot duration (per-rule override → tenant default).
 *   4. (real_day only) Fetch active bookings for that staff/date.
 *   5. Hand everything to `computeCapacityPreview` (Step 10 pure engine).
 */
@Injectable()
export class AvailabilityCapacityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TenantValidatorService,
    private readonly loader: AvailabilityLoaderService,
  ) {}

  async preview(params: CapacityPreviewParams): Promise<CapacityPreviewResult> {
    const { tenantId, staffMemberId, serviceId, date, mode } = params;

    await this.validator.assertStaffBelongsToTenant(staffMemberId, tenantId);
    const service = await this.validator.assertServiceBelongsToTenant(
      serviceId,
      tenantId,
    );

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { settings: true },
    });
    if (!tenant || !tenant.settings) {
      // Bootstrap invariant: every tenant has settings (created with the
      // tenant in AdminTenantsService). Defensive 404 covers a deleted-row
      // edge case rather than crashing.
      throw new NotFoundException("Tenant settings not found");
    }

    const resolved = await this.loader.loadAvailabilityConfigForDate({
      tenantId,
      staffMemberId,
      date,
    });

    // Slot duration: first window's per-rule override wins, else tenant default.
    // Multiple windows with different overrides is an edge case; we surface
    // the first window's value and document the choice.
    const slotDurationMinutes =
      resolved.windows[0]?.slotDurationMinutes ??
      tenant.settings.defaultSlotDurationMinutes;

    let existingBookings: ExistingBooking[] = [];
    if (mode === "real_day") {
      const dayBoundsUtc = computeDayBoundsUtc(date, tenant.timezone);
      const rows = await this.prisma.booking.findMany({
        where: {
          tenantId,
          staffMemberId,
          status: { in: ["pending", "confirmed"] },
          // A booking intersects the day if its start is before day_end AND
          // its end is after day_start (half-open intersect).
          startAt: { lt: dayBoundsUtc.end },
          endAt: { gt: dayBoundsUtc.start },
        },
        select: { startAt: true, endAt: true },
        orderBy: { startAt: "asc" },
      });
      existingBookings = rows.map((r) => ({
        startAt: r.startAt.toISOString(),
        endAt: r.endAt.toISOString(),
      }));
    }

    return computeCapacityPreview({
      date,
      tenantTimezone: tenant.timezone,
      windows: resolved.windows,
      breaks: resolved.breaks,
      slotDurationMinutes,
      serviceDurationMinutes: service.durationMinutes,
      bufferBeforeMinutes: service.bufferBeforeMinutes,
      bufferAfterMinutes: service.bufferAfterMinutes,
      mode,
      existingBookings,
    });
  }
}

function computeDayBoundsUtc(
  date: string,
  zone: string,
): { start: Date; end: Date } {
  const startLocal = DateTime.fromObject(
    {
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
      day: Number(date.slice(8, 10)),
    },
    { zone },
  );
  const endLocal = startLocal.plus({ days: 1 });
  return {
    start: startLocal.toUTC().toJSDate(),
    end: endLocal.toUTC().toJSDate(),
  };
}
