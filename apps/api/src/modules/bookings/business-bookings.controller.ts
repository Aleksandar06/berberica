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
import { Prisma, Role } from "@prisma/client";
import {
  bookingCancelInputSchema,
  bookingRescheduleInputSchema,
  bookingSetStatusInputSchema,
  businessBookingCreateInputSchema,
  businessBookingsListQuerySchema,
} from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { BusinessTenantGuard } from "../../common/guards/business-tenant.guard";
import { TenantRolesGuard } from "../../common/guards/tenant-roles.guard";
import type { RequestUser } from "../../common/types/request-user.types";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { PrismaService } from "../../prisma/prisma.service";
import { BookingManagementService } from "./booking-management.service";
import { BookingTransactionService } from "./booking-transaction.service";

class BusinessBookingCreateDto extends createZodDto(
  businessBookingCreateInputSchema,
) {}
class BookingsListQueryDto extends createZodDto(businessBookingsListQuerySchema) {}
class BookingCancelDto extends createZodDto(bookingCancelInputSchema) {}
class BookingRescheduleDto extends createZodDto(bookingRescheduleInputSchema) {}
class BookingSetStatusDto extends createZodDto(bookingSetStatusInputSchema) {}

@UseGuards(BusinessTenantGuard, TenantRolesGuard)
@Controller("business/bookings")
export class BusinessBookingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tx: BookingTransactionService,
    private readonly management: BookingManagementService,
  ) {}

  // -------------------------------------------------------------------------
  // LIST
  // -------------------------------------------------------------------------

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Get()
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BookingsListQueryDto,
  ) {
    const where: Prisma.BookingWhereInput = { tenantId: tenant.id };
    if (query.staffMemberId) where.staffMemberId = query.staffMemberId;
    if (query.status) where.status = query.status;
    if (query.fromDate || query.toDate) {
      where.startAt = {};
      if (query.fromDate) where.startAt.gte = new Date(`${query.fromDate}T00:00:00Z`);
      if (query.toDate)
        where.startAt.lt = new Date(
          new Date(`${query.toDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000,
        );
    }
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        orderBy: { startAt: "asc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          customer: {
            select: { id: true, firstName: true, lastName: true, phone: true, email: true },
          },
          staffMember: { select: { id: true, displayName: true } },
          service: { select: { id: true, name: true, durationMinutes: true } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    };
  }

  // -------------------------------------------------------------------------
  // CREATE (admin-created — same transactional safety as public)
  // -------------------------------------------------------------------------

  @Roles(Role.TENANT_ADMIN)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: RequestUser,
    @Body() body: BusinessBookingCreateDto,
  ) {
    return this.tx.createFromBusiness({ tenant, body, actor });
  }

  // -------------------------------------------------------------------------
  // CANCEL
  // -------------------------------------------------------------------------

  @Roles(Role.TENANT_ADMIN)
  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: BookingCancelDto,
  ) {
    return this.management.cancelByBusiness(id, tenant.id, body.reason, {
      userId: actor.userId,
      email: actor.email,
    });
  }

  // -------------------------------------------------------------------------
  // RESCHEDULE
  // -------------------------------------------------------------------------

  @Roles(Role.TENANT_ADMIN)
  @Post(":id/reschedule")
  @HttpCode(HttpStatus.OK)
  reschedule(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: BookingRescheduleDto,
  ) {
    return this.management.rescheduleByBusiness(
      id,
      tenant.id,
      body.newStartAt,
      body.reason,
      { userId: actor.userId, email: actor.email },
    );
  }

  // -------------------------------------------------------------------------
  // SET STATUS — arrived / no-show / completed
  // -------------------------------------------------------------------------
  // STAFF role is allowed in addition to TENANT_ADMIN because marking a
  // customer as arrived is a moment-to-moment shift action — the working
  // barber is usually STAFF, not the tenant owner.

  @Roles(Role.TENANT_ADMIN, Role.STAFF)
  @Patch(":id/status")
  @HttpCode(HttpStatus.OK)
  setStatus(
    @CurrentTenant() tenant: TenantContext,
    @CurrentUser() actor: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: BookingSetStatusDto,
  ) {
    return this.management.setStatusByBusiness(id, tenant.id, body.status, {
      userId: actor.userId,
      email: actor.email,
    });
  }
}
