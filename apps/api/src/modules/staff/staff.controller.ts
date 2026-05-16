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
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import {
  staffMemberCreateInputSchema,
  staffMemberUpdateInputSchema,
  staffServicesReplaceInputSchema,
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
import { StaffService } from "./staff.service";

class StaffCreateDto extends createZodDto(staffMemberCreateInputSchema) {}
class StaffUpdateDto extends createZodDto(staffMemberUpdateInputSchema) {}
class StaffServicesReplaceDto extends createZodDto(
  staffServicesReplaceInputSchema,
) {}

const listQuerySchema = z.object({
  isActive: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
});
class ListQueryDto extends createZodDto(listQuerySchema) {}

@UseGuards(BusinessTenantGuard, TenantRolesGuard)
@Controller("business/staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  // Reads — STAFF + TENANT_ADMIN.
  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query() query: ListQueryDto) {
    return this.staff.list(tenant.id, { isActive: query.isActive });
  }

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get(":id")
  get(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.staff.get(id, tenant.id);
  }

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get(":id/services")
  listAssignedServices(
    @CurrentTenant() tenant: TenantContext,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.staff.listAssignedServices(id, tenant.id);
  }

  // Mutations — TENANT_ADMIN only.
  @Roles(Role.TENANT_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Body() body: StaffCreateDto,
  ) {
    return this.staff.create(tenant.id, body, {
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
    @Body() body: StaffUpdateDto,
  ) {
    return this.staff.update(id, tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Delete(":id")
  delete(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    return this.staff.softDelete(id, tenant.id, {
      userId: user.userId,
      email: user.email,
    });
  }

  @Roles(Role.TENANT_ADMIN)
  @Put(":id/services")
  replaceServices(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: StaffServicesReplaceDto,
  ) {
    return this.staff.replaceServices(id, tenant.id, body, {
      userId: user.userId,
      email: user.email,
    });
  }
}
