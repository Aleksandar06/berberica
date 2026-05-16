import { Global, Module } from "@nestjs/common";

import { AdminTenantGuard } from "./guards/admin-tenant.guard";
import { BusinessTenantGuard } from "./guards/business-tenant.guard";
import { MaybeJwtAuthGuard } from "./guards/maybe-jwt-auth.guard";
import { PublicTenantGuard } from "./guards/public-tenant.guard";
import { SuperAdminGuard } from "./guards/super-admin.guard";
import { TenantRolesGuard } from "./guards/tenant-roles.guard";
import { AdminAuditService } from "./services/admin-audit.service";
import { AuditLogService } from "./services/audit-log.service";
import { TenantCacheService } from "./services/tenant-cache.service";
import { TenantOwnershipService } from "./services/tenant-ownership.service";
import { TenantValidatorService } from "./services/tenant-validator.service";

/**
 * Shared isolation primitives. Marked @Global so feature modules don't need
 * to re-import to use the guards/decorators/services. Step 5 is the foundation
 * every later step composes against — duplicating this wiring per module would
 * make it easy to forget pieces.
 */
@Global()
@Module({
  providers: [
    TenantCacheService,
    TenantOwnershipService,
    TenantValidatorService,
    AdminAuditService,
    AuditLogService,
    PublicTenantGuard,
    BusinessTenantGuard,
    AdminTenantGuard,
    SuperAdminGuard,
    TenantRolesGuard,
    MaybeJwtAuthGuard,
  ],
  exports: [
    TenantCacheService,
    TenantOwnershipService,
    TenantValidatorService,
    AdminAuditService,
    AuditLogService,
    PublicTenantGuard,
    BusinessTenantGuard,
    AdminTenantGuard,
    SuperAdminGuard,
    TenantRolesGuard,
    MaybeJwtAuthGuard,
  ],
})
export class CommonModule {}
