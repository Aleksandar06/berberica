import { Injectable } from "@nestjs/common";
import { Prisma, type Service } from "@prisma/client";
import type {
  ServiceCreateInput,
  ServiceUpdateInput,
} from "@scheduling/schemas";

import { AuditLogService } from "../../common/services/audit-log.service";
import { TenantOwnershipService } from "../../common/services/tenant-ownership.service";
import { PrismaService } from "../../prisma/prisma.service";

interface Actor {
  userId: string;
  email: string;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: TenantOwnershipService,
    private readonly audit: AuditLogService,
  ) {}

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  list(tenantId: string, opts: { isActive?: boolean }): Promise<Service[]> {
    const where: Prisma.ServiceWhereInput = { tenantId };
    if (opts.isActive !== undefined) where.isActive = opts.isActive;
    return this.prisma.service.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });
  }

  // ---------------------------------------------------------------------------
  // GET ONE
  // ---------------------------------------------------------------------------

  get(id: string, tenantId: string): Promise<Service> {
    return this.ownership.service(id, tenantId);
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    input: ServiceCreateInput,
    actor: Actor,
  ): Promise<Service> {
    const row = await this.prisma.service.create({
      data: {
        tenantId,
        name: input.name,
        description: input.description ?? null,
        durationMinutes: input.durationMinutes,
        bufferBeforeMinutes: input.bufferBeforeMinutes,
        bufferAfterMinutes: input.bufferAfterMinutes,
        priceCents: input.priceCents ?? null,
        isActive: input.isActive,
      },
    });
    await this.audit.record({
      action: "service.create",
      actorUserId: actor.userId,
      tenantId,
      metadata: {
        actorEmail: actor.email,
        serviceId: row.id,
        name: row.name,
        durationMinutes: row.durationMinutes,
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
    input: ServiceUpdateInput,
    actor: Actor,
  ): Promise<Service> {
    // Ownership check first — throws 404 if cross-tenant. Subsequent update
    // is by id alone because we already proved the row is ours.
    const before = await this.ownership.service(id, tenantId);

    const data: Prisma.ServiceUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.durationMinutes !== undefined)
      data.durationMinutes = input.durationMinutes;
    if (input.bufferBeforeMinutes !== undefined)
      data.bufferBeforeMinutes = input.bufferBeforeMinutes;
    if (input.bufferAfterMinutes !== undefined)
      data.bufferAfterMinutes = input.bufferAfterMinutes;
    if (input.priceCents !== undefined) data.priceCents = input.priceCents;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const after = await this.prisma.service.update({ where: { id }, data });
    await this.audit.record({
      action: "service.update",
      actorUserId: actor.userId,
      tenantId,
      metadata: {
        actorEmail: actor.email,
        serviceId: id,
        changed: changedFields(before, after),
      },
    });
    return after;
  }

  // ---------------------------------------------------------------------------
  // SOFT DELETE
  //
  // Why soft instead of hard:
  //   • `bookings.service_id` is FK Restrict (Step 2 schema). A hard delete
  //     on a service that still has any booking — past, present, or future —
  //     would fail with a FK violation. So even "if it has no bookings, hard
  //     delete" still violates the rule that historical booking detail must
  //     remain inspectable later.
  //   • Setting is_active=false removes it from the public storefront and
  //     blocks new bookings, while preserving every historical booking row
  //     intact. The admin can still view it via the list endpoint with
  //     `?isActive=false`.
  //
  // Future-bookings policy:
  //   We do NOT block deactivation when future bookings exist, and we do
  //   NOT cancel those bookings. Cancellation is an explicit, separate
  //   admin action (Step 11+). Rationale: the admin's intent (stop taking
  //   NEW bookings for this service) is orthogonal to whether existing
  //   commitments should be honored — often they should.
  // ---------------------------------------------------------------------------

  async softDelete(
    id: string,
    tenantId: string,
    actor: Actor,
  ): Promise<Service> {
    const before = await this.ownership.service(id, tenantId);
    if (!before.isActive) return before; // idempotent
    const after = await this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.record({
      action: "service.delete",
      actorUserId: actor.userId,
      tenantId,
      metadata: {
        actorEmail: actor.email,
        serviceId: id,
        kind: "soft",
      },
    });
    return after;
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
