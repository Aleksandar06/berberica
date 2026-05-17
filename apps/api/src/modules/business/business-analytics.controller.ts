import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Role } from "@prisma/client";
import { businessEarningsQuerySchema } from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BusinessTenantGuard } from "../../common/guards/business-tenant.guard";
import { TenantRolesGuard } from "../../common/guards/tenant-roles.guard";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { PrismaService } from "../../prisma/prisma.service";

class EarningsQueryDto extends createZodDto(businessEarningsQuerySchema) {}

/**
 * Business analytics — currently just the earnings report. Defined as a
 * read-only aggregation over the existing bookings + services tables, so
 * there's no new write path or denormalised state to maintain. Whenever a
 * service's `priceCents` is null we treat the booking's contribution as 0
 * (no money flowed — the venue still hasn't priced that service).
 *
 * Bucketed by booking status so a barber can see in one glance:
 *   • earned    — completed bookings * price (money in hand)
 *   • projected — pending/confirmed bookings in the future * price
 *   • lost      — cancelled + no-show bookings * price (foregone revenue)
 *
 * Bookings whose service was deleted/renamed survive — we aggregate from
 * the booking's `serviceId` join, so historical numbers stay stable even
 * if a service is renamed.
 */
@UseGuards(BusinessTenantGuard, TenantRolesGuard)
@Controller("business/analytics")
export class BusinessAnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get("earnings")
  async earnings(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: EarningsQueryDto,
  ) {
    // Default window: today only. Inclusive day-bounds → UTC half-open range.
    const todayIso = new Date().toISOString().slice(0, 10);
    const from = query.from ?? todayIso;
    const to = query.to ?? todayIso;
    const fromInstant = new Date(`${from}T00:00:00Z`);
    const toExclusive = new Date(`${to}T00:00:00Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);

    const bookings = await this.prisma.booking.findMany({
      where: {
        tenantId: tenant.id,
        startAt: { gte: fromInstant, lt: toExclusive },
      },
      select: {
        id: true,
        status: true,
        startAt: true,
        serviceId: true,
        staffMemberId: true,
        service: { select: { id: true, name: true, priceCents: true } },
        staffMember: { select: { id: true, displayName: true } },
      },
    });

    const tenantRow = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
      select: { currency: true },
    });
    const now = new Date();

    type Bucket = "earned" | "projected" | "lost" | "other";
    const bucketOf = (b: (typeof bookings)[number]): Bucket => {
      if (b.status === "completed") return "earned";
      if (b.status === "cancelled" || b.status === "no_show") return "lost";
      if (
        (b.status === "pending" || b.status === "confirmed") &&
        b.startAt > now
      ) {
        return "projected";
      }
      // In-the-past pending/confirmed bookings haven't been marked complete
      // yet — money technically not earned. Keep them in "projected" so the
      // barber sees they need to flip those rows to completed.
      if (b.status === "pending" || b.status === "confirmed") {
        return "projected";
      }
      return "other";
    };

    const buckets: Record<Bucket, { count: number; cents: number }> = {
      earned: { count: 0, cents: 0 },
      projected: { count: 0, cents: 0 },
      lost: { count: 0, cents: 0 },
      other: { count: 0, cents: 0 },
    };
    const byService = new Map<
      string,
      { id: string; name: string; count: number; cents: number }
    >();
    const byStaff = new Map<
      string,
      { id: string; displayName: string; count: number; cents: number }
    >();
    const byDay = new Map<string, { earnedCents: number; projectedCents: number }>();

    for (const b of bookings) {
      const cents = b.service.priceCents ?? 0;
      const bucket = bucketOf(b);
      buckets[bucket].count++;
      buckets[bucket].cents += cents;

      // Only earned + projected feed the breakdown lists — "lost" rows
      // don't represent revenue the venue can act on.
      if (bucket === "earned" || bucket === "projected") {
        const svc = byService.get(b.service.id) ?? {
          id: b.service.id,
          name: b.service.name,
          count: 0,
          cents: 0,
        };
        svc.count++;
        svc.cents += cents;
        byService.set(b.service.id, svc);

        const staff = byStaff.get(b.staffMember.id) ?? {
          id: b.staffMember.id,
          displayName: b.staffMember.displayName,
          count: 0,
          cents: 0,
        };
        staff.count++;
        staff.cents += cents;
        byStaff.set(b.staffMember.id, staff);
      }

      // Daily series for the chart — keyed by UTC day of the booking start.
      // Tenant timezones complicate this for non-UTC venues, but for the
      // hackathon scale a single-day-of-UTC bucket is "close enough" and
      // matches the date the query was bounded by.
      const dayKey = b.startAt.toISOString().slice(0, 10);
      const day = byDay.get(dayKey) ?? {
        earnedCents: 0,
        projectedCents: 0,
      };
      if (bucket === "earned") day.earnedCents += cents;
      else if (bucket === "projected") day.projectedCents += cents;
      byDay.set(dayKey, day);
    }

    // Pre-fill any days in the window that had zero bookings so the chart
    // shows the full timeline (no gaps).
    for (
      let d = new Date(fromInstant);
      d < toExclusive;
      d.setUTCDate(d.getUTCDate() + 1)
    ) {
      const dayKey = d.toISOString().slice(0, 10);
      if (!byDay.has(dayKey)) {
        byDay.set(dayKey, { earnedCents: 0, projectedCents: 0 });
      }
    }

    return {
      currency: tenantRow.currency,
      window: { from, to },
      totals: buckets,
      byService: Array.from(byService.values()).sort((a, b) => b.cents - a.cents),
      byStaff: Array.from(byStaff.values()).sort((a, b) => b.cents - a.cents),
      byDay: Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, vals]) => ({ date, ...vals })),
    };
  }
}
