import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import {
  availabilityBreakCreateInputSchema,
  availabilityBreakUpdateInputSchema,
  availabilityExceptionBreakCreateInputSchema,
  availabilityExceptionCreateInputSchema,
  availabilityRuleCreateInputSchema,
  availabilityRuleUpdateInputSchema,
  capacityPreviewQuerySchema,
  isoDateSchema,
  uuidSchema,
} from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";
import { z } from "zod";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BusinessTenantGuard } from "../../common/guards/business-tenant.guard";
import { TenantRolesGuard } from "../../common/guards/tenant-roles.guard";
import type { RequestUser } from "../../common/types/request-user.types";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { AvailabilityCapacityService } from "./availability-capacity.service";
import { AvailabilityConfigService } from "./availability-config.service";
import { AvailabilityLoaderService } from "./availability-loader.service";

// DTOs
class RuleCreateDto extends createZodDto(availabilityRuleCreateInputSchema) {}
class RuleUpdateDto extends createZodDto(availabilityRuleUpdateInputSchema) {}
class BreakCreateDto extends createZodDto(availabilityBreakCreateInputSchema) {}
class BreakUpdateDto extends createZodDto(availabilityBreakUpdateInputSchema) {}
class ExceptionCreateDto extends createZodDto(
  availabilityExceptionCreateInputSchema,
) {}
class ExceptionBreakCreateDto extends createZodDto(
  availabilityExceptionBreakCreateInputSchema,
) {}

const aggregateQuerySchema = z.object({
  staffMemberId: uuidSchema.optional(),
});
class AggregateQueryDto extends createZodDto(aggregateQuerySchema) {}

const resolveQuerySchema = z.object({
  staffMemberId: uuidSchema,
  date: isoDateSchema,
});
class ResolveQueryDto extends createZodDto(resolveQuerySchema) {}

class CapacityPreviewQueryDto extends createZodDto(
  capacityPreviewQuerySchema,
) {}

/**
 * Tenant-admin availability configuration.
 *
 * Routes:
 *   GET    /api/business/availability               aggregate (optional staff filter)
 *   GET    /api/business/availability/resolve       loader output for a (staff, date)
 *
 *   POST   /api/business/availability/rules
 *   PATCH  /api/business/availability/rules/:id
 *   DELETE /api/business/availability/rules/:id
 *
 *   POST   /api/business/availability/breaks
 *   PATCH  /api/business/availability/breaks/:id
 *   DELETE /api/business/availability/breaks/:id
 *
 *   POST   /api/business/availability/exceptions
 *   DELETE /api/business/availability/exceptions/:id
 *
 *   POST   /api/business/availability/exception-breaks
 *   DELETE /api/business/availability/exception-breaks/:id
 *
 * Tenant resolved via BusinessTenantGuard (session); never read from path/body.
 */
@UseGuards(BusinessTenantGuard, TenantRolesGuard)
@Controller("business/availability")
export class AvailabilityController {
  constructor(
    private readonly config: AvailabilityConfigService,
    private readonly loader: AvailabilityLoaderService,
    private readonly capacity: AvailabilityCapacityService,
  ) {}

  // ===========================================================================
  // AGGREGATE READS
  // ===========================================================================

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get()
  getAggregate(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: AggregateQueryDto,
  ) {
    return this.config.getAggregate(tenant.id, query.staffMemberId ?? null);
  }

  /**
   * Resolves the loader for a given (staff, date). Step 9 uses this
   * internally; exposed here so the admin UI can preview "what does Marko's
   * schedule look like on 2026-06-01?" without re-implementing the precedence
   * rules client-side.
   */
  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get("resolve")
  resolve(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ResolveQueryDto,
  ) {
    return this.loader.loadAvailabilityConfigForDate({
      tenantId: tenant.id,
      staffMemberId: query.staffMemberId,
      date: query.date,
    });
  }

  /**
   * Admin "what could fit today?" report. Distinguishes between:
   *   • # valid customer-facing start times (slot-grid driven), and
   *   • max non-overlapping bookings (packing of service+buffers).
   * See availability-capacity.ts for the algorithm.
   */
  @Roles(Role.TENANT_ADMIN)
  @Get("capacity-preview")
  capacityPreview(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CapacityPreviewQueryDto,
  ) {
    return this.capacity.preview({
      tenantId: tenant.id,
      staffMemberId: query.staffMemberId,
      serviceId: query.serviceId,
      date: query.date,
      mode: query.mode,
    });
  }

  // ===========================================================================
  // RULES
  // ===========================================================================

  @Roles(Role.TENANT_ADMIN)
  @Post("rules")
  @HttpCode(HttpStatus.CREATED)
  createRule(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: RuleCreateDto,
  ) {
    return this.config.createRule(tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Patch("rules/:id")
  updateRule(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: RuleUpdateDto,
  ) {
    return this.config.updateRule(id, tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Delete("rules/:id")
  deleteRule(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.config.deleteRule(id, tenant.id, {
      userId: user.userId,
      email: user.email,
    });
  }

  // ===========================================================================
  // BREAKS
  // ===========================================================================

  @Roles(Role.TENANT_ADMIN)
  @Post("breaks")
  @HttpCode(HttpStatus.CREATED)
  createBreak(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: BreakCreateDto,
  ) {
    return this.config.createBreak(tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Patch("breaks/:id")
  updateBreak(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: BreakUpdateDto,
  ) {
    return this.config.updateBreak(id, tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Delete("breaks/:id")
  deleteBreak(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.config.deleteBreak(id, tenant.id, {
      userId: user.userId,
      email: user.email,
    });
  }

  // ===========================================================================
  // EXCEPTIONS
  // ===========================================================================

  @Roles(Role.TENANT_ADMIN)
  @Post("exceptions")
  @HttpCode(HttpStatus.CREATED)
  createException(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: ExceptionCreateDto,
  ) {
    return this.config.createException(tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Delete("exceptions/:id")
  deleteException(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.config.deleteException(id, tenant.id, {
      userId: user.userId,
      email: user.email,
    });
  }

  // ===========================================================================
  // EXCEPTION BREAKS
  // ===========================================================================

  @Roles(Role.TENANT_ADMIN)
  @Post("exception-breaks")
  @HttpCode(HttpStatus.CREATED)
  createExceptionBreak(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: ExceptionBreakCreateDto,
  ) {
    return this.config.createExceptionBreak(tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Delete("exception-breaks/:id")
  deleteExceptionBreak(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.config.deleteExceptionBreak(id, tenant.id, {
      userId: user.userId,
      email: user.email,
    });
  }
}
