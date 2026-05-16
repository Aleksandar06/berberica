import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  type BookingRequestInput,
  bookingRequestInputSchema,
} from "@scheduling/schemas";
import type { FastifyRequest } from "fastify";
import { ZodValidationPipe } from "nestjs-zod";

import { CurrentTenant } from "../../common/decorators/current-tenant.decorator";
import { Public } from "../../common/decorators/public.decorator";
import { MaybeJwtAuthGuard } from "../../common/guards/maybe-jwt-auth.guard";
import { PublicTenantGuard } from "../../common/guards/public-tenant.guard";
import type { RequestUser } from "../../common/types/request-user.types";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { BookingTransactionService } from "../bookings/booking-transaction.service";
import { BookingVerificationService } from "../verification/booking-verification.service";

const bookingBodyPipe = new ZodValidationPipe(bookingRequestInputSchema);

/**
 * Public storefront booking. Two modes:
 *   • authenticated — bearer + the body's `mode: "authenticated"`.
 *   • guest         — no bearer + `mode: "guest"` + (Step 11A) a valid
 *                     `verificationGrant` proving the guest's email.
 *
 * Step 11A behavior:
 *   • Guest with no grant or invalid grant → 403 EMAIL_NOT_VERIFIED.
 *   • Valid grant → resolve to grantId, pass to BookingTransactionService
 *     which consumes it INSIDE the SERIALIZABLE TX after the booking insert
 *     succeeds. A 409 on the booking rolls back the consume → grant stays
 *     usable for a retry with another slot.
 */
@Public()
@UseGuards(PublicTenantGuard, MaybeJwtAuthGuard)
@Throttle({ default: { limit: 10, ttl: 60_000 } })
@Controller("public/:tenantSlug/bookings")
export class PublicBookingsController {
  constructor(
    private readonly bookings: BookingTransactionService,
    private readonly verification: BookingVerificationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body(bookingBodyPipe) body: BookingRequestInput,
    @Req() req: FastifyRequest & { user?: RequestUser },
  ) {
    let verificationContext: { kind: "verified"; grantId?: string };
    if (body.mode === "guest") {
      // Step 11A: guest bookings REQUIRE a verification grant.
      if (!body.verificationGrant) {
        throw new ForbiddenException({
          code: "EMAIL_NOT_VERIFIED",
          message:
            "Verify your email before completing this booking. Request an OTP at /bookings/verify/request and confirm it before retrying.",
        });
      }
      if (!body.guest.email) {
        throw new BadRequestException({
          code: "EMAIL_REQUIRED",
          message: "Guest bookings with verification require an email.",
        });
      }
      // Look up the grant — throws 403 if missing/expired/wrong-email/wrong-tenant.
      const grant = await this.verification.resolveGrant({
        rawGrantToken: body.verificationGrant,
        tenantId: tenant.id,
        expectedEmail: body.guest.email,
      });
      verificationContext = { kind: "verified", grantId: grant.id };
    } else {
      verificationContext = { kind: "verified" };
    }

    return this.bookings.createFromPublic({
      tenant,
      body,
      authUser: req.user ?? null,
      verificationContext,
    });
  }
}
