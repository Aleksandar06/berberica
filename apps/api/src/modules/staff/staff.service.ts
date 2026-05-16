import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { Prisma, type Service, type StaffMember } from "@prisma/client";
import type {
  StaffMemberCreateInput,
  StaffMemberUpdateInput,
  StaffServicesReplaceInput,
} from "@scheduling/schemas";

import { AuditLogService } from "../../common/services/audit-log.service";
import { TenantOwnershipService } from "../../common/services/tenant-ownership.service";
import { TenantValidatorService } from "../../common/services/tenant-validator.service";
import { PrismaService } from "../../prisma/prisma.service";

interface Actor {
  userId: string;
  email: string;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: TenantOwnershipService,
    private readonly validator: TenantValidatorService,
    private readonly audit: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------------
  // LIST / GET
  // ---------------------------------------------------------------------------

  list(tenantId: string, opts: { isActive?: boolean }): Promise<StaffMember[]> {
    const where: Prisma.StaffMemberWhereInput = { tenantId };
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    return this.prisma.staffMember.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    });
  }

  get(id: string, tenantId: string): Promise<StaffMember> {
    return this.ownership.staffMember(id, tenantId);
  }

  // ---------------------------------------------------------------------------
  // CREATE
  //
  // userId linkage rules:
  //   • Optional. When provided, the user must already exist AND have at
  //     least one membership in THIS tenant. Linking to a user with no
  //     membership here would cross tenants — rejected with 400.
  //   • `staff_members.user_id` has a UNIQUE constraint, so a user can only
  //     back one staff record platform-wide. We pre-check for a friendlier
  //     409 than the bare DB error.
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    input: StaffMemberCreateInput,
    actor: Actor,
  ): Promise<StaffMember> {
    if (input.userId) {
      await this.assertUserLinkableToTenant(input.userId, tenantId);
    }
    const row = await this.prisma.staffMember.create({
      data: {
        tenantId,
        displayName: input.displayName,
        userId: input.userId ?? null,
        isActive: input.isActive,
      },
    });
    await this.audit.record({
      action: "staff.create",
      actorUserId: actor.userId,
      tenantId,
      metadata: {
        actorEmail: actor.email,
        staffId: row.id,
        displayName: row.displayName,
        linkedUserId: row.userId,
      },
    });
    return row;
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    tenantId: string,
    input: StaffMemberUpdateInput,
    actor: Actor,
  ): Promise<StaffMember> {
    const before = await this.ownership.staffMember(id, tenantId);
    if (input.userId !== undefined && input.userId !== null) {
      await this.assertUserLinkableToTenant(input.userId, tenantId, id);
    }
    const data: Prisma.StaffMemberUpdateInput = {};
    if (input.displayName !== undefined) data.displayName = input.displayName;
    if (input.userId !== undefined) {
      data.user = input.userId === null
        ? { disconnect: true }
        : { connect: { id: input.userId } };
    }
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const after = await this.prisma.staffMember.update({
      where: { id },
      data,
    });
    await this.audit.record({
      action: "staff.update",
      actorUserId: actor.userId,
      tenantId,
      metadata: {
        actorEmail: actor.email,
        staffId: id,
        changed: changedFields(before, after),
      },
    });
    return after;
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  //
  // Same rationale as services: hard delete is blocked by FK Restrict on
  // bookings.staff_member_id, soft delete preserves history. Existing
  // future bookings remain assigned and visible; explicit cancellation is
  // a separate admin action (Step 11+).
  // ---------------------------------------------------------------------------

  async softDelete(
    id: string,
    tenantId: string,
    actor: Actor,
  ): Promise<StaffMember> {
    const before = await this.ownership.staffMember(id, tenantId);
    if (!before.isActive) return before;
    const after = await this.prisma.staffMember.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.record({
      action: "staff.delete",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, staffId: id, kind: "soft" },
    });
    return after;
  }

  // ===========================================================================
  // STAFF ↔ SERVICE ASSIGNMENT
  // ===========================================================================

  async listAssignedServices(
    staffId: string,
    tenantId: string,
  ): Promise<Service[]> {
    // Ownership check on the staff member (404 if cross-tenant).
    await this.ownership.staffMember(staffId, tenantId);
    const links = await this.prisma.staffService.findMany({
      where: { staffMemberId: staffId, tenantId },
      include: { service: true },
      orderBy: { service: { name: "asc" } },
    });
    return links.map((l) => l.service);
  }

  /**
   * Bulk-replace the staff member's assigned services.
   *
   * Validation:
   *   • Staff is tenant-owned (ownership helper, 404 if cross-tenant).
   *   • Every serviceId is tenant-owned (ownership helper per id; first
   *     cross-tenant id throws 404 and rolls back the request).
   *   • Duplicate serviceIds in the request are deduped server-side.
   *
   * Persistence:
   *   • Single transaction: deleteMany existing links for this staff,
   *     then createMany with the validated set. Uniqueness on
   *     (staffMemberId, serviceId) is preserved by the dedupe + clean
   *     starting state.
   */
  async replaceServices(
    staffId: string,
    tenantId: string,
    input: StaffServicesReplaceInput,
    actor: Actor,
  ): Promise<Service[]> {
    await this.ownership.staffMember(staffId, tenantId);
    const uniqueServiceIds = Array.from(new Set(input.serviceIds));

    // Per-id ownership check — first cross-tenant id throws 404, no DB
    // mutation has happened yet, so the whole request rolls back cleanly.
    for (const serviceId of uniqueServiceIds) {
      await this.validator.assertServiceBelongsToTenant(serviceId, tenantId);
    }

    await this.prisma.$transaction([
      this.prisma.staffService.deleteMany({
        where: { staffMemberId: staffId, tenantId },
      }),
      ...(uniqueServiceIds.length > 0
        ? [
            this.prisma.staffService.createMany({
              data: uniqueServiceIds.map((serviceId) => ({
                staffMemberId: staffId,
                serviceId,
                tenantId,
              })),
            }),
          ]
        : []),
    ]);

    await this.audit.record({
      action: "staff.services.replace",
      actorUserId: actor.userId,
      tenantId,
      metadata: {
        actorEmail: actor.email,
        staffId,
        serviceIds: uniqueServiceIds,
        count: uniqueServiceIds.length,
      },
    });

    return this.listAssignedServices(staffId, tenantId);
  }

  // ---------------------------------------------------------------------------

  private async assertUserLinkableToTenant(
    userId: string,
    tenantId: string,
    /** Pass when updating; existing record may already hold the link. */
    selfStaffId?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        staffMember: { select: { id: true } },
        tenantRoles: { where: { tenantId }, select: { id: true } },
      },
    });
    if (!user) {
      // 400 because the admin sent us a userId that doesn't resolve — this
      // isn't a tenant-isolation IDOR (user table isn't tenant-scoped),
      // it's a malformed link request.
      throw new BadRequestException("Linked user does not exist");
    }
    if (user.tenantRoles.length === 0) {
      throw new BadRequestException(
        "Linked user is not a member of this tenant",
      );
    }
    if (user.staffMember && user.staffMember.id !== selfStaffId) {
      throw new ConflictException(
        "User is already linked to another staff record",
      );
    }
  }
}

function changedFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after) as Array<keyof T>) {
    if (String(k) === "updatedAt" || String(k) === "createdAt") continue;
    if (before[k] !== after[k]) {
      out[k as string] = { from: before[k], to: after[k] };
    }
  }
  return out;
}

