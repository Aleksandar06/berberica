import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  type AvailabilityBreak,
  type AvailabilityException,
  type AvailabilityExceptionBreak,
  type AvailabilityRule,
} from "@prisma/client";
import type {
  AvailabilityBreakCreateInput,
  AvailabilityBreakUpdateInput,
  AvailabilityExceptionBreakCreateInput,
  AvailabilityExceptionCreateInput,
  AvailabilityRuleCreateInput,
  AvailabilityRuleUpdateInput,
} from "@scheduling/schemas";

import { AuditLogService } from "../../common/services/audit-log.service";
import { TenantOwnershipService } from "../../common/services/tenant-ownership.service";
import { TenantValidatorService } from "../../common/services/tenant-validator.service";
import { PrismaService } from "../../prisma/prisma.service";

interface Actor {
  userId: string;
  email: string;
}

/**
 * CRUD for the four availability-config entities, with the validation rules
 * the Step 9 engine relies on:
 *
 *   • Rules and breaks: no overlapping/duplicate entries within the same
 *     SCOPE (same tenant + same staff scope + same day_of_week). Two scopes
 *     are distinct iff `staff_member_id` differs (NULL = "tenant-wide" is
 *     its own scope, not a wildcard).
 *   • Exceptions: at most one per (tenant, scope, date). Server rejects
 *     duplicates with 409 — the admin must DELETE the existing one before
 *     adding a new one.
 *   • Exception breaks: same overlap-per-scope rule as weekly breaks, but
 *     keyed on (tenant, scope, exception_date).
 *
 * Out-of-working-hours breaks are ALLOWED. The engine simply subtracts
 * breaks from the resolved working window — a break that lies entirely
 * outside the window has no effect. This keeps schedule editing low-friction.
 */
@Injectable()
export class AvailabilityConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: TenantOwnershipService,
    private readonly validator: TenantValidatorService,
    private readonly audit: AuditLogService,
  ) {}

  // ===========================================================================
  // AGGREGATE READ
  // ===========================================================================

  async getAggregate(
    tenantId: string,
    staffMemberId?: string | null,
  ): Promise<{
    rules: AvailabilityRule[];
    breaks: AvailabilityBreak[];
    exceptions: AvailabilityException[];
    exceptionBreaks: AvailabilityExceptionBreak[];
  }> {
    if (staffMemberId) {
      await this.validator.assertStaffBelongsToTenant(staffMemberId, tenantId);
    }
    // Scope filter — when staffMemberId given, include staff-specific AND
    // tenant-wide (null) rows: both apply to that staff per the precedence
    // rules. When omitted, return the full config.
    const scopeFilter = staffMemberId
      ? { OR: [{ staffMemberId }, { staffMemberId: null }] }
      : {};

    const [rules, breaks, exceptions, exceptionBreaks] = await Promise.all([
      this.prisma.availabilityRule.findMany({
        where: { tenantId, ...scopeFilter },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      this.prisma.availabilityBreak.findMany({
        where: { tenantId, ...scopeFilter },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      }),
      this.prisma.availabilityException.findMany({
        where: { tenantId, ...scopeFilter },
        orderBy: [{ exceptionDate: "asc" }],
      }),
      this.prisma.availabilityExceptionBreak.findMany({
        where: { tenantId, ...scopeFilter },
        orderBy: [{ exceptionDate: "asc" }, { startTime: "asc" }],
      }),
    ]);
    return { rules, breaks, exceptions, exceptionBreaks };
  }

  // ===========================================================================
  // RULES
  // ===========================================================================

  async createRule(
    tenantId: string,
    input: AvailabilityRuleCreateInput,
    actor: Actor,
  ): Promise<AvailabilityRule> {
    if (input.staffMemberId) {
      await this.validator.assertStaffBelongsToTenant(
        input.staffMemberId,
        tenantId,
      );
    }
    await this.assertNoRuleOverlap(
      tenantId,
      input.staffMemberId ?? null,
      input.dayOfWeek,
      input.startTime,
      input.endTime,
    );
    const row = await this.prisma.availabilityRule.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId ?? null,
        dayOfWeek: input.dayOfWeek,
        startTime: timeStringToDate(input.startTime),
        endTime: timeStringToDate(input.endTime),
        slotDurationMinutes: input.slotDurationMinutes ?? null,
        isActive: input.isActive,
      },
    });
    await this.audit.record({
      action: "availability.rule.create",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, ruleId: row.id },
    });
    return row;
  }

  async updateRule(
    id: string,
    tenantId: string,
    input: AvailabilityRuleUpdateInput,
    actor: Actor,
  ): Promise<AvailabilityRule> {
    const before = await this.ownership.availabilityRule(id, tenantId);
    if (
      input.staffMemberId !== undefined &&
      input.staffMemberId !== null
    ) {
      await this.validator.assertStaffBelongsToTenant(
        input.staffMemberId,
        tenantId,
      );
    }
    // Merge input with existing for the overlap check.
    const merged = {
      staffMemberId:
        input.staffMemberId !== undefined
          ? input.staffMemberId
          : before.staffMemberId,
      dayOfWeek: input.dayOfWeek ?? before.dayOfWeek,
      startTime: input.startTime ?? dateToTimeString(before.startTime),
      endTime: input.endTime ?? dateToTimeString(before.endTime),
    };
    await this.assertNoRuleOverlap(
      tenantId,
      merged.staffMemberId,
      merged.dayOfWeek,
      merged.startTime,
      merged.endTime,
      id,
    );

    const data: Prisma.AvailabilityRuleUpdateInput = {};
    if (input.staffMemberId !== undefined) {
      data.staffMember =
        input.staffMemberId === null
          ? { disconnect: true }
          : { connect: { id: input.staffMemberId } };
    }
    if (input.dayOfWeek !== undefined) data.dayOfWeek = input.dayOfWeek;
    if (input.startTime !== undefined)
      data.startTime = timeStringToDate(input.startTime);
    if (input.endTime !== undefined)
      data.endTime = timeStringToDate(input.endTime);
    if (input.slotDurationMinutes !== undefined)
      data.slotDurationMinutes = input.slotDurationMinutes;
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const after = await this.prisma.availabilityRule.update({
      where: { id },
      data,
    });
    await this.audit.record({
      action: "availability.rule.update",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, ruleId: id },
    });
    return after;
  }

  async deleteRule(
    id: string,
    tenantId: string,
    actor: Actor,
  ): Promise<{ id: string }> {
    await this.ownership.availabilityRule(id, tenantId);
    await this.prisma.availabilityRule.delete({ where: { id } });
    await this.audit.record({
      action: "availability.rule.delete",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, ruleId: id },
    });
    return { id };
  }

  // ===========================================================================
  // BREAKS
  // ===========================================================================

  async createBreak(
    tenantId: string,
    input: AvailabilityBreakCreateInput,
    actor: Actor,
  ): Promise<AvailabilityBreak> {
    if (input.staffMemberId) {
      await this.validator.assertStaffBelongsToTenant(
        input.staffMemberId,
        tenantId,
      );
    }
    await this.assertNoBreakOverlap(
      tenantId,
      input.staffMemberId ?? null,
      input.dayOfWeek,
      input.startTime,
      input.endTime,
    );
    const row = await this.prisma.availabilityBreak.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId ?? null,
        dayOfWeek: input.dayOfWeek,
        startTime: timeStringToDate(input.startTime),
        endTime: timeStringToDate(input.endTime),
        isActive: input.isActive,
      },
    });
    await this.audit.record({
      action: "availability.break.create",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, breakId: row.id },
    });
    return row;
  }

  async updateBreak(
    id: string,
    tenantId: string,
    input: AvailabilityBreakUpdateInput,
    actor: Actor,
  ): Promise<AvailabilityBreak> {
    const before = await this.ownership.availabilityBreak(id, tenantId);
    if (
      input.staffMemberId !== undefined &&
      input.staffMemberId !== null
    ) {
      await this.validator.assertStaffBelongsToTenant(
        input.staffMemberId,
        tenantId,
      );
    }
    const merged = {
      staffMemberId:
        input.staffMemberId !== undefined
          ? input.staffMemberId
          : before.staffMemberId,
      dayOfWeek: input.dayOfWeek ?? before.dayOfWeek,
      startTime: input.startTime ?? dateToTimeString(before.startTime),
      endTime: input.endTime ?? dateToTimeString(before.endTime),
    };
    await this.assertNoBreakOverlap(
      tenantId,
      merged.staffMemberId,
      merged.dayOfWeek,
      merged.startTime,
      merged.endTime,
      id,
    );

    const data: Prisma.AvailabilityBreakUpdateInput = {};
    if (input.staffMemberId !== undefined) {
      data.staffMember =
        input.staffMemberId === null
          ? { disconnect: true }
          : { connect: { id: input.staffMemberId } };
    }
    if (input.dayOfWeek !== undefined) data.dayOfWeek = input.dayOfWeek;
    if (input.startTime !== undefined)
      data.startTime = timeStringToDate(input.startTime);
    if (input.endTime !== undefined)
      data.endTime = timeStringToDate(input.endTime);
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const after = await this.prisma.availabilityBreak.update({
      where: { id },
      data,
    });
    await this.audit.record({
      action: "availability.break.update",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, breakId: id },
    });
    return after;
  }

  async deleteBreak(
    id: string,
    tenantId: string,
    actor: Actor,
  ): Promise<{ id: string }> {
    await this.ownership.availabilityBreak(id, tenantId);
    await this.prisma.availabilityBreak.delete({ where: { id } });
    await this.audit.record({
      action: "availability.break.delete",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, breakId: id },
    });
    return { id };
  }

  // ===========================================================================
  // EXCEPTIONS
  // ===========================================================================

  async createException(
    tenantId: string,
    input: AvailabilityExceptionCreateInput,
    actor: Actor,
  ): Promise<AvailabilityException> {
    if (input.staffMemberId) {
      await this.validator.assertStaffBelongsToTenant(
        input.staffMemberId,
        tenantId,
      );
    }
    // One exception per (tenant, scope, date). Reject duplicates with 409 —
    // the admin must DELETE the existing one before creating a replacement.
    // Rationale: silent overwrites lose audit fidelity ("who changed this
    // 'closed' to 'custom hours'?" is an important question).
    const dupe = await this.prisma.availabilityException.findFirst({
      where: {
        tenantId,
        staffMemberId: input.staffMemberId ?? null,
        exceptionDate: dateStringToDate(input.exceptionDate),
      },
      select: { id: true },
    });
    if (dupe) {
      throw new ConflictException(
        "An exception already exists for this date in this scope",
      );
    }

    const row = await this.prisma.availabilityException.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId ?? null,
        exceptionDate: dateStringToDate(input.exceptionDate),
        isClosed: input.isClosed,
        customStartTime: input.customStartTime
          ? timeStringToDate(input.customStartTime)
          : null,
        customEndTime: input.customEndTime
          ? timeStringToDate(input.customEndTime)
          : null,
        reason: input.reason ?? null,
      },
    });
    await this.audit.record({
      action: "availability.exception.create",
      actorUserId: actor.userId,
      tenantId,
      metadata: {
        actorEmail: actor.email,
        exceptionId: row.id,
        date: input.exceptionDate,
        isClosed: input.isClosed,
      },
    });
    return row;
  }

  async deleteException(
    id: string,
    tenantId: string,
    actor: Actor,
  ): Promise<{ id: string }> {
    await this.ownership.availabilityException(id, tenantId);
    await this.prisma.availabilityException.delete({ where: { id } });
    await this.audit.record({
      action: "availability.exception.delete",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, exceptionId: id },
    });
    return { id };
  }

  // ===========================================================================
  // EXCEPTION BREAKS
  // ===========================================================================

  async createExceptionBreak(
    tenantId: string,
    input: AvailabilityExceptionBreakCreateInput,
    actor: Actor,
  ): Promise<AvailabilityExceptionBreak> {
    if (input.staffMemberId) {
      await this.validator.assertStaffBelongsToTenant(
        input.staffMemberId,
        tenantId,
      );
    }
    await this.assertNoExceptionBreakOverlap(
      tenantId,
      input.staffMemberId ?? null,
      input.exceptionDate,
      input.startTime,
      input.endTime,
    );
    const row = await this.prisma.availabilityExceptionBreak.create({
      data: {
        tenantId,
        staffMemberId: input.staffMemberId ?? null,
        exceptionDate: dateStringToDate(input.exceptionDate),
        startTime: timeStringToDate(input.startTime),
        endTime: timeStringToDate(input.endTime),
        reason: input.reason ?? null,
      },
    });
    await this.audit.record({
      action: "availability.exception_break.create",
      actorUserId: actor.userId,
      tenantId,
      metadata: {
        actorEmail: actor.email,
        exceptionBreakId: row.id,
        date: input.exceptionDate,
      },
    });
    return row;
  }

  async deleteExceptionBreak(
    id: string,
    tenantId: string,
    actor: Actor,
  ): Promise<{ id: string }> {
    const row = await this.prisma.availabilityExceptionBreak.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Not found");
    await this.prisma.availabilityExceptionBreak.delete({ where: { id } });
    await this.audit.record({
      action: "availability.exception_break.delete",
      actorUserId: actor.userId,
      tenantId,
      metadata: { actorEmail: actor.email, exceptionBreakId: id },
    });
    return { id };
  }

  // ===========================================================================
  // INTERNAL: overlap checks
  // ===========================================================================

  private async assertNoRuleOverlap(
    tenantId: string,
    staffMemberId: string | null,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<void> {
    const overlap = await this.prisma.availabilityRule.findFirst({
      where: {
        tenantId,
        staffMemberId,
        dayOfWeek,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        // Two ranges overlap when newStart < existingEnd AND existingStart < newEnd
        AND: [
          { startTime: { lt: timeStringToDate(endTime) } },
          { endTime: { gt: timeStringToDate(startTime) } },
        ],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException(
        "Overlapping or duplicate availability rule for this scope",
      );
    }
  }

  private async assertNoBreakOverlap(
    tenantId: string,
    staffMemberId: string | null,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<void> {
    const overlap = await this.prisma.availabilityBreak.findFirst({
      where: {
        tenantId,
        staffMemberId,
        dayOfWeek,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [
          { startTime: { lt: timeStringToDate(endTime) } },
          { endTime: { gt: timeStringToDate(startTime) } },
        ],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException(
        "Overlapping or duplicate break for this scope",
      );
    }
  }

  private async assertNoExceptionBreakOverlap(
    tenantId: string,
    staffMemberId: string | null,
    exceptionDate: string,
    startTime: string,
    endTime: string,
    excludeId?: string,
  ): Promise<void> {
    const overlap = await this.prisma.availabilityExceptionBreak.findFirst({
      where: {
        tenantId,
        staffMemberId,
        exceptionDate: dateStringToDate(exceptionDate),
        ...(excludeId ? { id: { not: excludeId } } : {}),
        AND: [
          { startTime: { lt: timeStringToDate(endTime) } },
          { endTime: { gt: timeStringToDate(startTime) } },
        ],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException(
        "Overlapping or duplicate exception break for this scope/date",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Time / date helpers — Prisma TIME(0) and DATE columns map to JS Date with
// a 1970-01-01 anchor for TIMEs and a UTC-midnight anchor for DATEs. Keep
// these private to the availability module to avoid leaking the convention
// elsewhere.
// ---------------------------------------------------------------------------

export function timeStringToDate(t: string): Date {
  return new Date(`1970-01-01T${t}:00Z`);
}

export function dateToTimeString(d: Date): string {
  return d.toISOString().substring(11, 16);
}

export function dateStringToDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
