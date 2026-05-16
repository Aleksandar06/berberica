import { Module } from "@nestjs/common";

import { AdminAnalyticsController } from "./admin-analytics.controller";
import { AdminImpersonationController } from "./admin-impersonation.controller";
import { AdminTenantsController } from "./admin-tenants.controller";
import { AdminTenantsService } from "./admin-tenants.service";

/**
 * SUPER_ADMIN-only endpoints under `/api/admin/...`. Every controller is
 * guarded by SuperAdminGuard at the controller level; AuditLogService is
 * the single writer of state-change audit rows.
 */
@Module({
  controllers: [
    AdminTenantsController,
    AdminAnalyticsController,
    AdminImpersonationController,
  ],
  providers: [AdminTenantsService],
})
export class AdminModule {}
