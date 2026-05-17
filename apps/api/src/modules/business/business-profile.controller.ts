import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { tenantUpdateInputSchema } from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BusinessTenantGuard } from "../../common/guards/business-tenant.guard";
import { TenantRolesGuard } from "../../common/guards/tenant-roles.guard";
import { AuditLogService } from "../../common/services/audit-log.service";
import { TenantCacheService } from "../../common/services/tenant-cache.service";
import type { RequestUser } from "../../common/types/request-user.types";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { PrismaService } from "../../prisma/prisma.service";

class TenantProfileUpdateDto extends createZodDto(tenantUpdateInputSchema) {}

/**
 * Tenant profile (display fields). Tenant is resolved from the session by
 * BusinessTenantGuard — no `tenantId` ever read from path or body.
 */
@UseGuards(BusinessTenantGuard, TenantRolesGuard)
@Controller("business/profile")
export class BusinessProfileController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: TenantCacheService,
    private readonly audit: AuditLogService,
  ) {}

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get()
  async get(@CurrentTenant() tenant: TenantContext) {
    const row = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: {
        id: true,
        slug: true,
        name: true,
        businessType: true,
        timezone: true,
        currency: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        status: true,
      },
    });
    if (!row) throw new NotFoundException("Not found");
    return row;
  }

  @Roles(Role.TENANT_ADMIN)
  @Patch()
  async update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: TenantProfileUpdateDto,
  ) {
    const before = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenant.id },
    });
    const after = await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: body.name ?? undefined,
        businessType: body.businessType ?? undefined,
        timezone: body.timezone ?? undefined,
        currency: body.currency ?? undefined,
        contactEmail: body.contactEmail,
        contactPhone: body.contactPhone,
        address: body.address,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        businessType: true,
        timezone: true,
        currency: true,
        contactEmail: true,
        contactPhone: true,
        address: true,
        status: true,
      },
    });

    await this.audit.record({
      action: "tenant.profile.update",
      actorUserId: user.userId,
      tenantId: tenant.id,
      metadata: {
        actorEmail: user.email,
        changed: shallowDiff(before, after),
      },
    });
    await this.cache.invalidate(tenant.slug);
    return after;
  }
}

function shallowDiff<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after) as Array<keyof T>) {
    if (before[k] !== after[k]) {
      out[k as string] = { from: before[k], to: after[k] };
    }
  }
  return out;
}
