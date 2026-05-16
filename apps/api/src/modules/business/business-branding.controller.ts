import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { tenantBrandingUpdateInputSchema } from "@scheduling/schemas";
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

class TenantBrandingUpdateDto extends createZodDto(
  tenantBrandingUpdateInputSchema,
) {}

/**
 * Branding: colors + logoUrl.
 *
 * NOTE: actual file upload (PNG/JPG/SVG → MinIO/Supabase Storage) is built
 * in the storage step. Today `logoUrl` accepts any URL the admin pastes —
 * convenient for placeholder hosted images. The schema's URL validation
 * still applies.
 */
@UseGuards(BusinessTenantGuard, TenantRolesGuard)
@Controller("business/branding")
export class BusinessBrandingController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get()
  async get(@CurrentTenant() tenant: TenantContext) {
    const branding = await this.prisma.tenantBrandingAssets.findUnique({
      where: { tenantId: tenant.id },
    });
    if (!branding) throw new NotFoundException("Branding not found");
    return branding;
  }

  @Roles(Role.TENANT_ADMIN)
  @Patch()
  async update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: TenantBrandingUpdateDto,
  ) {
    const before = await this.prisma.tenantBrandingAssets.findUniqueOrThrow({
      where: { tenantId: tenant.id },
    });
    const after = await this.prisma.tenantBrandingAssets.update({
      where: { tenantId: tenant.id },
      data: { ...body },
    });
    await this.audit.record({
      action: "tenant.branding.update",
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
