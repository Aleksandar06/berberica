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
  serviceCreateInputSchema,
  serviceUpdateInputSchema,
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
import { ServicesService } from "./services.service";

class ServiceCreateDto extends createZodDto(serviceCreateInputSchema) {}
class ServiceUpdateDto extends createZodDto(serviceUpdateInputSchema) {}

// Optional ?isActive=true|false filter on the list. Booleanish coercion so
// query strings work without ceremony.
const listQuerySchema = z.object({
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
});
class ListQueryDto extends createZodDto(listQuerySchema) {}

@UseGuards(BusinessTenantGuard, TenantRolesGuard)
@Controller("business/services")
export class ServicesController {
  constructor(private readonly services: ServicesService) {}

  // Staff can view the catalog (they read services to schedule appointments).
  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListQueryDto) {
    return this.services.list(tenant.id, { isActive: query.isActive });
  }

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get(":id")
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.services.get(id, tenant.id);
  }

  // Mutations require TENANT_ADMIN within the active tenant.
  @Roles(Role.TENANT_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: ServiceCreateDto,
  ) {
    return this.services.create(tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Patch(":id")
  update(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: ServiceUpdateDto,
  ) {
    return this.services.update(id, tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  // Soft delete — see services.service.ts header comment for rationale.
  @Roles(Role.TENANT_ADMIN)
  @Delete(":id")
  delete(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.services.softDelete(id, tenant.id, {
      userId: user.userId,
      email: user.email,
    });
  }
}
