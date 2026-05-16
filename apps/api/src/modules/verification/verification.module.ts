import { Module } from "@nestjs/common";

import { AccountVerificationController } from "./account-verification.controller";
import { AccountVerificationService } from "./account-verification.service";
import { BookingVerificationController } from "./booking-verification.controller";
import { BookingVerificationService } from "./booking-verification.service";

/**
 * Step 11A — account-email verification + guest booking OTP.
 *
 * Controllers:
 *   • AccountVerificationController     /api/auth/verify-email
 *                                       /api/auth/resend-verification
 *   • BookingVerificationController     /api/public/:tenantSlug/bookings/verify/request
 *                                       /api/public/:tenantSlug/bookings/verify/confirm
 *
 * Exports:
 *   • AccountVerificationService — consumed by AuthService to issue the
 *     account-verification token on register.
 *   • BookingVerificationService — consumed by BookingTransactionService
 *     to resolve + consume guest grants inside the booking TX.
 */
@Module({
  controllers: [AccountVerificationController, BookingVerificationController],
  providers: [AccountVerificationService, BookingVerificationService],
  exports: [AccountVerificationService, BookingVerificationService],
})
export class VerificationModule {}
