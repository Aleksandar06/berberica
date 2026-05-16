import {
  Body,
  Controller,
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
import {
  adminCreateTenantInputSchema,
  adminListTenantsQuerySchema,
  tenantReactivateInputSchema,
  tenantSuspendInputSchema,
  tenantUpdateInputSchema,
} from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SuperAdminGuard } from "../../common/guards/super-admin.guard";
import type { RequestUser } from "../../common/types/request-user.types";
import { AdminTenantsService } from "./admin-tenants.service";

// DTOs — thin Nest wrappers around the shared Zod schemas.
class AdminCreateTenantDto extends createZodDto(adminCreateTenantInputSchema) {}
class AdminListTenantsQueryDto extends createZodDto(
  adminListTenantsQuerySchema,
) {}
class TenantUpdateDto extends createZodDto(tenantUpdateInputSchema) {}
class TenantSuspendDto extends createZodDto(tenantSuspendInputSchema) {}
class TenantReactivateDto extends createZodDto(tenantReactivateInputSchema) {}

/**
 * SUPER_ADMIN tenant lifecycle endpoints. Audit-logged via AuditLogService
 * inside AdminTenantsService — controller stays thin.
 */
@UseGuards(SuperAdminGuard)
@Controller("admin/tenants")
export class AdminTenantsController {
  constructor(private readonly tenants: AdminTenantsService) {}

  @Get()
  list(@Query() query: AdminListTenantsQueryDto) {
    return this.tenants.list(query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() body: AdminCreateTenantDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tenants.create(body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Get(":id")
  get(@Param("id", new ParseUUIDPipe()) id: string) {
    return this.tenants.getOne(id);
  }

  @Patch(":id")
  update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: TenantUpdateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tenants.update(id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Post(":id/suspend")
  @HttpCode(HttpStatus.OK)
  suspend(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: TenantSuspendDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tenants.setStatus(id, "suspended", body.reason, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Post(":id/reactivate")
  @HttpCode(HttpStatus.OK)
  reactivate(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: TenantReactivateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.tenants.setStatus(id, "active", body.reason, {
      userId: user.userId,
      email: user.email,
    });
  }
}
