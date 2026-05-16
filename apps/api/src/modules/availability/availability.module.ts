import { Module } from "@nestjs/common";

import { AvailabilityCapacityService } from "./availability-capacity.service";
import { AvailabilityConfigService } from "./availability-config.service";
import { AvailabilityLoaderService } from "./availability-loader.service";
import { AvailabilityController } from "./availability.controller";

@Module({
  controllers: [AvailabilityController],
  providers: [
    AvailabilityConfigService,
    AvailabilityLoaderService,
    AvailabilityCapacityService,
  ],
  // Loader exported so Step 11 (booking) can inject it without
  // re-implementing the precedence rules.
  exports: [AvailabilityLoaderService],
})
export class AvailabilityModule {}
