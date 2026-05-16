import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ANY_STAFF,
  publicAvailabilityQuerySchema,
} from "@scheduling/schemas";
import { DateTime } from "luxon";
import { createZodDto } from "nestjs-zod";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { PublicTenantGuard } from "../../common/guards/public-tenant.guard";
import { TenantValidatorService } from "../../common/services/tenant-validator.service";
import type { TenantContext } from "../../common/types/tenant-context.types";
import {
  computeAvailableSlots,
  type ExistingBooking,
} from "../availability/availability-engine";
import { computeAnyStaffSlots } from "../availability/availability-engine.aggregate";
import { AvailabilityLoaderService } from "../availability/availability-loader.service";
import { PrismaService } from "../../prisma/prisma.service";

class AvailabilityQueryDto extends createZodDto(publicAvailabilityQuerySchema) {}

/**
 * Public availability lookup. Returns ONLY the valid slots — no admin
 * preview reasons, no warnings. Stricter rate-limit because storefronts
 * tend to poll this on every date pick.
 */
@Public()
@UseGuards(PublicTenantGuard)
@Throttle({ default: { limit: 60, ttl: 60_000 } }) // 60/min/IP
@Controller("public/:tenantSlug/availability")
export class PublicAvailabilityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: TenantValidatorService,
    private readonly loader: AvailabilityLoaderService,
  ) {}

  @Get()
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AvailabilityQueryDto,
  ) {
    // Service ownership — cross-tenant id → 404.
    const service = await this.validator.assertServiceBelongsToTenant(
      query.serviceId,
      tenant.id,
    );

    const tenantRow = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
      include: { settings: true },
    });
    const settings = tenantRow.settings!;
    const tenantTz = tenantRow.timezone;

    // For "any" we aggregate across qualifying staff; for explicit staff
    // we validate ownership + that they can perform the service, then
    // run the engine once.
    if (query.staffId === ANY_STAFF) {
      const candidates = await this.prisma.staffService.findMany({
        where: {
          tenantId: tenant.id,
          serviceId: service.id,
          staffMember: { isActive: true },
        },
        select: { staffMemberId: true },
      });
      if (candidates.length === 0) {
        return { date: query.date, slots: [] };
      }
      const inputs = await Promise.all(
        candidates.map(async (c) => ({
          staffMemberId: c.staffMemberId,
          per: await this.buildEngineInput({
            tenantId: tenant.id,
            staffMemberId: c.staffMemberId,
            tenantTz,
            settings,
            service,
            date: query.date,
          }),
        })),
      );
      const { slots } = computeAnyStaffSlots(inputs);
      return {
        date: query.date,
        slots: slots.map((s) => ({
          startUtc: s.startUtc,
          endUtc: s.endUtc,
          displayTime: s.displayTime,
          // Don't surface the full staff list — exposes scheduling internals.
          // The booking endpoint picks deterministically on "any".
          anyStaffAvailable: s.availableStaffMemberIds.length > 0,
        })),
      };
    }

    // Specific staff path — validate ownership AND link.
    await this.validator.assertStaffBelongsToTenant(query.staffId, tenant.id);
    await this.validator.assertStaffCanPerformService(
      query.staffId,
      service.id,
      tenant.id,
    );
    const per = await this.buildEngineInput({
      tenantId: tenant.id,
      staffMemberId: query.staffId,
      tenantTz,
      settings,
      service,
      date: query.date,
    });
    const result = computeAvailableSlots(per);
    return {
      date: query.date,
      slots: result.slots.map((s) => ({
        startUtc: s.startUtc,
        endUtc: s.endUtc,
        displayTime: s.displayTime,
      })),
    };
  }

  // -------------------------------------------------------------------------

  private async buildEngineInput(args: {
    tenantId: string;
    staffMemberId: string;
    tenantTz: string;
    settings: {
      defaultSlotDurationMinutes: number;
      bookingLeadTimeMinutes: number;
      bookingMaxDaysAhead: number;
    };
    service: {
      durationMinutes: number;
      bufferBeforeMinutes: number;
      bufferAfterMinutes: number;
    };
    date: string;
  }) {
    const resolved = await this.loader.loadAvailabilityConfigForDate({
      tenantId: args.tenantId,
      staffMemberId: args.staffMemberId,
      date: args.date,
    });
    const slotDuration =
      resolved.windows[0]?.slotDurationMinutes ??
      args.settings.defaultSlotDurationMinutes;

    const dayStartUtc = DateTime.fromObject(
      {
        year: Number(args.date.slice(0, 4)),
        month: Number(args.date.slice(5, 7)),
        day: Number(args.date.slice(8, 10)),
      },
      { zone: args.tenantTz },
    )
      .toUTC()
      .toJSDate();
    const dayEndUtc = DateTime.fromObject(
      {
        year: Number(args.date.slice(0, 4)),
        month: Number(args.date.slice(5, 7)),
        day: Number(args.date.slice(8, 10)),
      },
      { zone: args.tenantTz },
    )
      .plus({ days: 1 })
      .toUTC()
      .toJSDate();

    const bookings = await this.prisma.booking.findMany({
      where: {
        tenantId: args.tenantId,
        staffMemberId: args.staffMemberId,
        status: { in: ["pending", "confirmed"] },
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc },
      },
      select: { startAt: true, endAt: true },
    });
    const existingBookings: ExistingBooking[] = bookings.map((b) => ({
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
    }));

    return {
      date: args.date,
      tenantTimezone: args.tenantTz,
      windows: resolved.windows,
      breaks: resolved.breaks,
      slotDurationMinutes: slotDuration,
      serviceDurationMinutes: args.service.durationMinutes,
      bufferBeforeMinutes: args.service.bufferBeforeMinutes,
      bufferAfterMinutes: args.service.bufferAfterMinutes,
      existingBookings,
      minLeadTimeMinutes: args.settings.bookingLeadTimeMinutes,
      maxDaysAhead: args.settings.bookingMaxDaysAhead,
    };
  }
}
