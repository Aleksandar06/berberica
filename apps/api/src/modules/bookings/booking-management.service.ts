import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type Booking } from "@prisma/client";
import { DateTime } from "luxon";

import { AuditLogService } from "../../common/services/audit-log.service";
import { TenantOwnershipService } from "../../common/services/tenant-ownership.service";
import { PrismaService } from "../../prisma/prisma.service";
import { computeAvailableSlots } from "../availability/availability-engine";
import { AvailabilityLoaderService } from "../availability/availability-loader.service";

interface Actor {
  userId: string;
  email: string;
}

/**
 * Booking cancellation + reschedule, shared by business + customer routes.
 *
 * Cancellation contract: status flips to "cancelled". Because the Step 2
 * exclusion constraint is PARTIAL on `status IN ('pending','confirmed')`,
 * the cancelled row immediately stops blocking that slot — no row delete
 * needed, history is preserved, the slot reopens.
 *
 * Reschedule contract: same booking row, mutated start_at/end_at after a
 * fresh availability recompute (excluding THIS booking from the existing
 * set so we don't self-conflict). Wrapped in SERIALIZABLE so concurrent
 * inserts can't sneak into the freed window.
 */
@Injectable()
export class BookingManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: TenantOwnershipService,
    private readonly loader: AvailabilityLoaderService,
    private readonly audit: AuditLogService,
  ) {}

  // -------------------------------------------------------------------------
  // CANCEL
  // -------------------------------------------------------------------------

  async cancelByBusiness(
    bookingId: string,
    tenantId: string,
    reason: string | undefined,
    actor: Actor,
  ): Promise<Booking> {
    const before = await this.ownership.booking(bookingId, tenantId);
    return this.applyCancel({
      before,
      tenantId,
      reason: reason ?? null,
      actor,
      source: "business",
      policyCheck: () => undefined, // tenant admin bypasses cutoff policy
    });
  }

  async cancelByCustomer(
    bookingId: string,
    userId: string,
    reason: string | undefined,
    actorEmail: string,
  ): Promise<Booking> {
    const before = await this.fetchBookingForCustomer(bookingId, userId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: before.tenantId },
      include: { settings: true },
    });
    return this.applyCancel({
      before,
      tenantId: before.tenantId,
      reason: reason ?? null,
      actor: { userId, email: actorEmail },
      source: "customer",
      policyCheck: () => {
        if (!tenant.settings?.allowCustomerCancellation) {
          throw new ForbiddenException({
            code: "CANCELLATION_DISABLED",
            message: "Customer cancellation is not allowed for this business.",
          });
        }
        const cutoffMs = tenant.settings.cancellationCutoffMinutes * 60_000;
        const earliest = before.startAt.getTime() - cutoffMs;
        if (Date.now() > earliest) {
          throw new ForbiddenException({
            code: "CANCELLATION_CUTOFF",
            message: "The cancellation window for this booking has passed.",
          });
        }
      },
    });
  }

  // -------------------------------------------------------------------------
  // RESCHEDULE
  // -------------------------------------------------------------------------

  async rescheduleByBusiness(
    bookingId: string,
    tenantId: string,
    newStartAtIso: string,
    reason: string | undefined,
    actor: Actor,
  ): Promise<Booking> {
    const before = await this.ownership.booking(bookingId, tenantId);
    return this.applyReschedule({
      before,
      tenantId,
      newStartAtIso,
      reason: reason ?? null,
      actor,
      source: "business",
      policyCheck: () => undefined,
    });
  }

  async rescheduleByCustomer(
    bookingId: string,
    userId: string,
    newStartAtIso: string,
    reason: string | undefined,
    actorEmail: string,
  ): Promise<Booking> {
    const before = await this.fetchBookingForCustomer(bookingId, userId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: before.tenantId },
      include: { settings: true },
    });
    return this.applyReschedule({
      before,
      tenantId: before.tenantId,
      newStartAtIso,
      reason: reason ?? null,
      actor: { userId, email: actorEmail },
      source: "customer",
      policyCheck: () => {
        if (!tenant.settings?.allowCustomerReschedule) {
          throw new ForbiddenException({
            code: "RESCHEDULE_DISABLED",
            message: "Customer reschedule is not allowed for this business.",
          });
        }
        const cutoffMs = tenant.settings.rescheduleCutoffMinutes * 60_000;
        const earliest = before.startAt.getTime() - cutoffMs;
        if (Date.now() > earliest) {
          throw new ForbiddenException({
            code: "RESCHEDULE_CUTOFF",
            message: "The reschedule window for this booking has passed.",
          });
        }
      },
    });
  }

  // =========================================================================
  // INTERNAL
  // =========================================================================

  /**
   * Look up a booking the customer can act on. JOINs through `customers`
   * to enforce that the booking's customer row belongs to THIS user — a
   * customer can never read/modify another customer's booking.
   *
   * Returns 404 (not 403) on mismatch — never leak existence.
   */
  private async fetchBookingForCustomer(
    bookingId: string,
    userId: string,
  ): Promise<Booking> {
    const row = await this.prisma.booking.findFirst({
      where: { id: bookingId, customer: { userId } },
    });
    if (!row) throw new NotFoundException("Not found");
    return row;
  }

  private async applyCancel(args: {
    before: Booking;
    tenantId: string;
    reason: string | null;
    actor: Actor;
    source: "business" | "customer";
    policyCheck: () => void;
  }): Promise<Booking> {
    args.policyCheck();
    if (args.before.status === "cancelled") {
      return args.before; // idempotent
    }
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.booking.update({
        where: { id: args.before.id },
        data: { status: "cancelled" },
      });
      await tx.bookingAuditLog.create({
        data: {
          tenantId: args.tenantId,
          bookingId: after.id,
          actorUserId: args.actor.userId,
          action: "booking.cancel",
          metadata: {
            source: args.source,
            actorEmail: args.actor.email,
            previousStatus: args.before.status,
            reason: args.reason,
          } as Prisma.JsonObject,
        },
      });
      await tx.notificationEvent.create({
        data: {
          tenantId: args.tenantId,
          bookingId: after.id,
          type: "booking.cancelled",
          status: "pending",
          payload: {
            bookingId: after.id,
            reason: args.reason,
          } as Prisma.JsonObject,
        },
      });
      return after;
    });
  }

  private async applyReschedule(args: {
    before: Booking;
    tenantId: string;
    newStartAtIso: string;
    reason: string | null;
    actor: Actor;
    source: "business" | "customer";
    policyCheck: () => void;
  }): Promise<Booking> {
    args.policyCheck();
    if (args.before.status === "cancelled") {
      throw new ConflictException({
        code: "BOOKING_CANCELLED",
        message: "Cancelled bookings cannot be rescheduled.",
      });
    }

    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: args.tenantId },
      include: { settings: true },
    });
    const service = await this.prisma.service.findUniqueOrThrow({
      where: { id: args.before.serviceId },
    });
    const tenantTz = tenant.timezone;
    const newDateStr = DateTime.fromISO(args.newStartAtIso, { zone: "utc" })
      .setZone(tenantTz)
      .toFormat("yyyy-LL-dd");
    const wanted = DateTime.fromISO(args.newStartAtIso, {
      zone: "utc",
    }).toUTC();

    return this.prisma.$transaction(
      async (tx) => {
        // Existing bookings on the target date, EXCLUDING the one we're moving.
        const dayLocal = DateTime.fromISO(args.newStartAtIso, { zone: "utc" })
          .setZone(tenantTz)
          .startOf("day");
        const existing = await tx.booking.findMany({
          where: {
            tenantId: args.tenantId,
            staffMemberId: args.before.staffMemberId,
            status: { in: ["pending", "confirmed"] },
            id: { not: args.before.id },
            startAt: { lt: dayLocal.plus({ days: 1 }).toUTC().toJSDate() },
            endAt: { gt: dayLocal.toUTC().toJSDate() },
          },
          select: { startAt: true, endAt: true },
        });

        const resolved = await this.loader.loadAvailabilityConfigForDate({
          tenantId: args.tenantId,
          staffMemberId: args.before.staffMemberId,
          date: newDateStr,
        });
        const slotDuration =
          resolved.windows[0]?.slotDurationMinutes ??
          (tenant.settings?.defaultSlotDurationMinutes ?? 15);
        const r = computeAvailableSlots({
          date: newDateStr,
          tenantTimezone: tenantTz,
          windows: resolved.windows,
          breaks: resolved.breaks,
          slotDurationMinutes: slotDuration,
          serviceDurationMinutes: service.durationMinutes,
          bufferBeforeMinutes: service.bufferBeforeMinutes,
          bufferAfterMinutes: service.bufferAfterMinutes,
          existingBookings: existing.map((b) => ({
            startAt: b.startAt.toISOString(),
            endAt: b.endAt.toISOString(),
          })),
          minLeadTimeMinutes: tenant.settings?.bookingLeadTimeMinutes ?? 0,
          maxDaysAhead: tenant.settings?.bookingMaxDaysAhead ?? 60,
        });
        const ok = r.slots.some((s) =>
          DateTime.fromISO(s.startUtc, { zone: "utc" }).equals(wanted),
        );
        if (!ok) {
          throw new ConflictException({
            code: "SLOT_UNAVAILABLE",
            message: "That time is not available — please pick another.",
          });
        }

        const blockedStart = wanted
          .minus({ minutes: service.bufferBeforeMinutes })
          .toJSDate();
        const blockedEnd = wanted
          .plus({
            minutes: service.durationMinutes + service.bufferAfterMinutes,
          })
          .toJSDate();

        let after: Booking;
        try {
          after = await tx.booking.update({
            where: { id: args.before.id },
            data: { startAt: blockedStart, endAt: blockedEnd },
          });
        } catch (err) {
          if (isExclusionViolation(err)) {
            throw new ConflictException({
              code: "SLOT_TAKEN",
              message:
                "That time was just taken by another booking — please pick another.",
            });
          }
          throw err;
        }

        await tx.bookingAuditLog.create({
          data: {
            tenantId: args.tenantId,
            bookingId: after.id,
            actorUserId: args.actor.userId,
            action: "booking.reschedule",
            metadata: {
              source: args.source,
              actorEmail: args.actor.email,
              fromStartAt: args.before.startAt.toISOString(),
              toStartAt: after.startAt.toISOString(),
              reason: args.reason,
            } as Prisma.JsonObject,
          },
        });
        await tx.notificationEvent.create({
          data: {
            tenantId: args.tenantId,
            bookingId: after.id,
            type: "booking.rescheduled",
            status: "pending",
            payload: {
              bookingId: after.id,
              fromStartAt: args.before.startAt.toISOString(),
              toStartAt: after.startAt.toISOString(),
            } as Prisma.JsonObject,
          },
        });
        return after;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
        maxWait: 5_000,
      },
    );
  }
}

function isExclusionViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message =
    "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  return (
    message.includes("bookings_no_overlap_per_staff") ||
    (err as { code?: unknown }).code === "23P01"
  );
}
