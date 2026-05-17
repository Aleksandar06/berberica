import { Module } from "@nestjs/common";

import { BusinessAnalyticsController } from "./business-analytics.controller";
import { BusinessBrandingController } from "./business-branding.controller";
import { BusinessProfileController } from "./business-profile.controller";
import { BusinessSettingsController } from "./business-settings.controller";

/**
 * Tenant-admin business management under `/api/business/...`. Every
 * controller is guarded by BusinessTenantGuard + TenantRolesGuard, so the
 * resolved tenant comes from the session and the body's `tenantId` (if
 * smuggled) is structurally ignored.
 */
@Module({
  controllers: [
    BusinessProfileController,
    BusinessSettingsController,
    BusinessBrandingController,
    BusinessAnalyticsController,
  ],
})
export class BusinessModule {}
