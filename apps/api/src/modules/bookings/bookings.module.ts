import { Module } from "@nestjs/common";

import { AvailabilityModule } from "../availability/availability.module";
import { VerificationModule } from "../verification/verification.module";
import { BookingManagementService } from "./booking-management.service";
import { BookingTransactionService } from "./booking-transaction.service";
import { BusinessBookingsController } from "./business-bookings.controller";
import { CustomerBookingsController } from "./customer-bookings.controller";

/**
 * Bookings module — owns the SERIALIZABLE create transaction and the
 * cancel/reschedule management flow. Imports:
 *   • AvailabilityModule — Step 8 loader for the in-TX recompute.
 *   • VerificationModule — Step 11A grant consumption inside the booking TX.
 * Exports the transaction service so PublicModule can compose it for
 * `/api/public/:slug/bookings`.
 */
@Module({
  imports: [AvailabilityModule, VerificationModule],
  controllers: [BusinessBookingsController, CustomerBookingsController],
  providers: [BookingTransactionService, BookingManagementService],
  exports: [BookingTransactionService, BookingManagementService],
})
export class BookingsModule {}
