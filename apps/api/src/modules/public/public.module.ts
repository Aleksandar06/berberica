import { Module } from "@nestjs/common";

import { AvailabilityModule } from "../availability/availability.module";
import { BookingsModule } from "../bookings/bookings.module";
import { VerificationModule } from "../verification/verification.module";
import { PublicAvailabilityController } from "./public-availability.controller";
import { PublicBookingsController } from "./public-bookings.controller";
import { PublicTenantInfoController } from "./public-tenant-info.controller";

/**
 * Storefront-facing endpoints under `/api/public/:tenantSlug/...`.
 * Composes:
 *   • AvailabilityModule's loader for date resolution.
 *   • BookingsModule's BookingTransactionService for the create flow.
 *   • VerificationModule's BookingVerificationService for the Step 11A
 *     guest grant pre-check on the public booking endpoint.
 */
@Module({
  imports: [AvailabilityModule, BookingsModule, VerificationModule],
  controllers: [
    PublicTenantInfoController,
    PublicAvailabilityController,
    PublicBookingsController,
  ],
})
export class PublicModule {}
