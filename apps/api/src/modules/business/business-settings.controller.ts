import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { tenantSettingsUpdateInputSchema } from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BusinessTenantGuard } from "../../common/guards/business-tenant.guard";
import { TenantRolesGuard } from "../../common/guards/tenant-roles.guard";
import { AuditLogService } from "../../common/services/audit-log.service";
import type { RequestUser } from "../../common/types/request-user.types";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { PrismaService } from "../../prisma/prisma.service";

class TenantSettingsUpdateDto extends createZodDto(
  tenantSettingsUpdateInputSchema,
) {}

/**
 * Tenant settings (booking policy fields). Cache invalidation is NOT
 * required here — these fields don't appear in CachedTenant. Audit row
 * captures the change for compliance.
 */
@UseGuards(BusinessTenantGuard, TenantRolesGuard)
@Controller("business/settings")
export class BusinessSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get()
  async get(@CurrentTenant() tenant: TenantContext) {
    const settings = await this.prisma.tenantSettings.findUnique({
      where: { tenantId: tenant.id },
    });
    if (!settings) {
      // Tenants are created with a default settings row; absence is a bug.
      throw new NotFoundException("Settings not found");
    }
    return settings;
  }

  @Roles(Role.TENANT_ADMIN)
  @Patch()
  async update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: TenantSettingsUpdateDto,
  ) {
    const before = await this.prisma.tenantSettings.findUniqueOrThrow({
      where: { tenantId: tenant.id },
    });
    const after = await this.prisma.tenantSettings.update({
      where: { tenantId: tenant.id },
      // body is already strict-validated by ZodValidationPipe; spreading it
      // is safe — the schema forbids `tenantId` and similar non-settings
      // fields, so a smuggled-in tenantId in the JSON would be rejected by
      // Zod before reaching this line.
      data: { ...body },
    });
    await this.audit.record({
      action: "tenant.settings.update",
      actorUserId: user.userId,
      tenantId: tenant.id,
      metadata: {
        actorEmail: user.email,
        changed: shallowDiff(before, after),
      },
    });
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
