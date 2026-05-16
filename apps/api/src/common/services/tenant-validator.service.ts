import { Injectable, NotFoundException } from "@nestjs/common";
import type { Service, StaffMember } from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";
import { TenantOwnershipService } from "./tenant-ownership.service";

/**
 * Reusable domain validators that the availability engine (Step 9) and
 * booking engine (Step 11) lean on. Built on TenantOwnershipService so
 * the "id+tenantId, not found → 404" invariant is consistent across the
 * codebase.
 *
 * Add new asserts here as later steps need them — never re-implement these
 * patterns in feature services (a forgotten tenantId filter is how IDOR
 * bugs slip in).
 */
@Injectable()
export class TenantValidatorService {
  constructor(
    private readonly ownership: TenantOwnershipService,
    private readonly prisma: PrismaService,
  ) {}

  /** Throws 404 if the service doesn't exist OR belongs to another tenant. */
  assertServiceBelongsToTenant(
    serviceId: string,
    tenantId: string,
  ): Promise<Service> {
    return this.ownership.service(serviceId, tenantId);
  }

  /** Throws 404 if the staff member doesn't exist OR belongs to another tenant. */
  assertStaffBelongsToTenant(
    staffId: string,
    tenantId: string,
  ): Promise<StaffMember> {
    return this.ownership.staffMember(staffId, tenantId);
  }

  /**
   * Throws 404 if the staff member is not assigned to perform this service
   * within the tenant. Used by:
   *   • Step 11 booking flow: prevents booking a service against a staff
   *     member who isn't trained / assigned to perform it.
   *   • Step 9 availability engine: same purpose, applied to the listing
   *     of bookable slots.
   *
   * Filters by all three (staff, service, tenant) in a single query so a
   * cross-tenant link — should one ever materialize — also returns 404.
   */
  async assertStaffCanPerformService(
    staffMemberId: string,
    serviceId: string,
    tenantId: string,
  ): Promise<void> {
    const link = await this.prisma.staffService.findFirst({
      where: { staffMemberId, serviceId, tenantId },
      select: { id: true },
    });
    if (!link) {
      throw new NotFoundException("Not found");
    }
  }
}
