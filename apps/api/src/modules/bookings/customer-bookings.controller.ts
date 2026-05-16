import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  bookingCancelInputSchema,
  bookingRescheduleInputSchema,
} from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.types";
import { PrismaService } from "../../prisma/prisma.service";
import { BookingManagementService } from "./booking-management.service";

class BookingCancelDto extends createZodDto(bookingCancelInputSchema) {}
class BookingRescheduleDto extends createZodDto(bookingRescheduleInputSchema) {}

/**
 * `/api/customer/bookings/...` — authenticated user views/manages their OWN
 * bookings across all tenants they've booked at.
 *
 * No tenant guard: a customer with bookings at multiple tenants sees them
 * all in one place. Ownership is enforced via the JOIN through
 * `customers.user_id` — a booking belongs to this user iff the linked
 * Customer row's user_id matches. Cross-customer access returns 404 (the
 * `findFirst` simply doesn't match — no existence leak).
 *
 * Cancellation + reschedule additionally enforce the booking's tenant
 * policy (allow_customer_*, *_cutoff_minutes).
 */
@Controller("customer/bookings")
export class CustomerBookingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly management: BookingManagementService,
  ) {}

  @Get()
  async list(@CurrentUser() user: RequestUser) {
    return this.prisma.booking.findMany({
      where: { customer: { userId: user.userId } },
      orderBy: { startAt: "desc" },
      include: {
        tenant: { select: { id: true, slug: true, name: true, timezone: true } },
        service: { select: { id: true, name: true, durationMinutes: true } },
        staffMember: { select: { id: true, displayName: true } },
      },
    });
  }

  @Get(":id")
  async get(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
  ) {
    const row = await this.prisma.booking.findFirst({
      where: { id, customer: { userId: user.userId } },
      include: {
        tenant: { select: { slug: true, name: true, timezone: true } },
        service: { select: { name: true, durationMinutes: true } },
        staffMember: { select: { displayName: true } },
      },
    });
    if (!row) {
      // Generic 404 — no existence leak across customers.
      return { error: { code: "NOT_FOUND", message: "Not found" } };
    }
    return row;
  }

  @Post(":id/cancel")
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: BookingCancelDto,
  ) {
    return this.management.cancelByCustomer(
      id,
      user.userId,
      body.reason,
      user.email,
    );
  }

  @Post(":id/reschedule")
  @HttpCode(HttpStatus.OK)
  reschedule(
    @CurrentUser() user: RequestUser,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() body: BookingRescheduleDto,
  ) {
    return this.management.rescheduleByCustomer(
      id,
      user.userId,
      body.newStartAt,
      body.reason,
      user.email,
    );
  }
}
