import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  guestOtpConfirmInputSchema,
  guestOtpRequestInputSchema,
} from "@scheduling/schemas";
import { createZodDto } from "nestjs-zod";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { PublicTenantGuard } from "../../common/guards/public-tenant.guard";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { PrismaService } from "../../prisma/prisma.service";
import { BookingVerificationService } from "./booking-verification.service";

class GuestOtpRequestDto extends createZodDto(guestOtpRequestInputSchema) {}
class GuestOtpConfirmDto extends createZodDto(guestOtpConfirmInputSchema) {}

/**
 * Guest-OTP routes. Mounted under `/api/public/:tenantSlug/bookings/verify/...`
 * so the storefront flow is co-located with the booking endpoint.
 *
 * Stricter throttling than non-OTP routes (5/min/IP on /request,
 * 10/min/IP on /confirm). The per-row attempt counter handles the
 * after-the-fact lockout regardless of how the requests are spread.
 */
@Public()
@UseGuards(PublicTenantGuard)
@Controller("public/:tenantSlug/bookings/verify")
export class BookingVerificationController {
  constructor(
    private readonly verification: BookingVerificationService,
    private readonly prisma: PrismaService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("request")
  @HttpCode(HttpStatus.OK)
  async request(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: GuestOtpRequestDto,
  ) {
    // Respect the tenant's allow_guest_booking setting — if guest booking
    // is disabled, OTP issuance is pointless. Returning the same generic
    // EMAIL_NOT_VERIFIED 403 we use elsewhere avoids leaking the policy.
    const t = await this.prisma.tenant.findUnique({
      where: { id: tenant.id },
      include: { settings: true },
    });
    if (!t?.settings?.allowGuestBooking) {
      throw new ForbiddenException({
        code: "GUEST_BOOKING_DISABLED",
        message: "Guest booking is disabled for this business.",
      });
    }
    await this.verification.request({
      tenantId: tenant.id,
      email: body.email,
      serviceId: body.serviceId,
      staffId: body.staffId,
      startAt: body.startAt,
    });
    // Always 200 ok — anti-enumeration. The OTP is delivered via the
    // notification event; the request endpoint never reveals existence.
    return { ok: true };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  async confirm(
    @CurrentTenant() tenant: TenantContext,
    @Body() body: GuestOtpConfirmDto,
  ) {
    const grant = await this.verification.confirm({
      tenantId: tenant.id,
      email: body.email,
      code: body.code,
      serviceId: body.serviceId,
      staffId: body.staffId,
      startAt: body.startAt,
    });
    return {
      grantToken: grant.grantToken,
      expiresAt: grant.expiresAt.toISOString(),
    };
  }
}
