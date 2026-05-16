import { Controller, Get, UseGuards } from "@nestjs/common";

import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Platform-level aggregates. Strictly counts — no per-tenant rows, no PII,
 * no booking specifics. Anything richer should land under
 * /api/admin/tenants/:id/* with explicit AdminTenantGuard for the audit hook.
 */
@UseGuards(SuperAdminGuard)
@Controller("admin/analytics")
export class AdminAnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async snapshot() {
    const [
      totalTenants,
      activeTenants,
      suspendedTenants,
      totalUsers,
      totalServices,
      totalStaff,
      totalBookings,
      bookingsByStatus,
    ] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: "active" } }),
      this.prisma.tenant.count({ where: { status: "suspended" } }),
      this.prisma.user.count(),
      this.prisma.service.count(),
      this.prisma.staffMember.count(),
      this.prisma.booking.count(),
      this.prisma.booking.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
    ]);

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        suspended: suspendedTenants,
      },
      users: { total: totalUsers },
      services: { total: totalServices },
      staff: { total: totalStaff },
      bookings: {
        total: totalBookings,
        byStatus: Object.fromEntries(
          bookingsByStatus.map((g) => [g.status, g._count._all]),
        ),
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
