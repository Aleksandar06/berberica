import { Controller, Get, UseGuards } from "@nestjs/common";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { PublicTenantGuard } from "../../common/guards/public-tenant.guard";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * Storefront read endpoints under `/api/public/:tenantSlug/...`. All
 * @Public (no auth) + PublicTenantGuard (tenant from slug, suspended → 403).
 *
 * Return shapes are intentionally minimal — no `tenant_id` echoed back,
 * no contact email if not public-safe (this is the public storefront, so
 * tenant.contactEmail IS published — it's how customers reach the business).
 */
@Public()
@UseGuards(PublicTenantGuard)
@Controller("public/:tenantSlug")
export class PublicTenantInfoController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("profile")
  async getProfile(@CurrentTenant() tenant: TenantContext) {
    const row = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
      select: {
        name: true,
        slug: true,
        businessType: true,
        timezone: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        branding: {
          select: {
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            accentColor: true,
          },
        },
      },
    });
    return row;
  }

  @Get("services")
  listServices(@CurrentTenant() tenant: TenantContext) {
    return this.prisma.service.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        bufferBeforeMinutes: true,
        bufferAfterMinutes: true,
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Public staff list — only active staff. Each entry surfaces the IDs of
   * services they can perform, so the storefront can render the "any staff
   * who can do X" picker without a second roundtrip.
   */
  @Get("staff")
  async listStaff(@CurrentTenant() tenant: TenantContext) {
    const rows = await this.prisma.staffMember.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        displayName: true,
        staffServices: {
          select: { serviceId: true },
        },
      },
      orderBy: { displayName: "asc" },
    });
    return rows.map((s) => ({
      id: s.id,
      displayName: s.displayName,
      serviceIds: s.staffServices.map((ss) => ss.serviceId),
    }));
  }
}
