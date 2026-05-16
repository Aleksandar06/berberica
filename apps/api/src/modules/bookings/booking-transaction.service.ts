/**
 * =============================================================================
 *  BOOKING TRANSACTION SERVICE — Step 11 (the second most security-critical)
 * =============================================================================
 *
 *  Shared by:
 *    • POST /api/public/:tenantSlug/bookings    (guest or authenticated)
 *    • POST /api/business/bookings              (tenant-admin on behalf of)
 *
 *  Why it's a single service: the transactional safety story must be
 *  identical for both code paths. Forking the logic per controller is how
 *  IDOR / double-booking bugs slip in.
 *
 *  Safety layers (each one redundant with the next):
 *    1. Tenant resolution → Step 5 guards. tenant_id never comes from the body.
 *    2. Ownership validation → Step 7 helpers reject cross-tenant service/staff.
 *    3. Backend recompute → Step 9 engine re-derives the valid slot set for
 *       the exact submitted moment. The client's slot string is never trusted.
 *    4. SERIALIZABLE transaction → Postgres detects conflicting read-modify-
 *       write phantom-row collisions. Bounded retry on serialization failure.
 *    5. Exclusion constraint (Step 2 `bookings_no_overlap_per_staff`) → final
 *       guard. Even two concurrent SERIALIZABLE TXs that both pass the
 *       recompute (due to read-anomaly races) will collide here, and the
 *       loser receives a friendly 409.
 *
 *  Step-11A forward-reference:
 *    The `verificationContext` param is a hook for the OTP gate. In Step 11
 *    every caller passes `{ kind: "verified" }` (no gate). Step 11A's public
 *    booking endpoint will replace that with grant-derived values, and this
 *    service will refuse `{ kind: "unverified" }` for guests when the
 *    tenant policy requires verification. The gate is a CHECK ONLY — the
 *    availability recompute (#3) and exclusion constraint (#5) still run.
 * =============================================================================
 */
import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  Prisma,
  type Booking,
  type Service,
  type TenantSettings,
} from "@prisma/client";
import type {
  BookingRequestInput,
  BusinessBookingCreateInput,
} from "@scheduling/schemas";
import { ANY_STAFF } from "@scheduling/schemas";
import { DateTime } from "luxon";

import { AuditLogService } from "../../common/services/audit-log.service";
import { TenantOwnershipService } from "../../common/services/tenant-ownership.service";
import { TenantValidatorService } from "../../common/services/tenant-validator.service";
import type { RequestUser } from "../../common/types/request-user.types";
import type { TenantContext } from "../../common/types/tenant-context.types";
import { computeAvailableSlots } from "../availability/availability-engine";
import { AvailabilityLoaderService } from "../availability/availability-loader.service";
import { BookingVerificationService } from "../verification/booking-verification.service";
import { PrismaService } from "../../prisma/prisma.service";

// =============================================================================
// PUBLIC TYPES
// =============================================================================

export interface VerificationContext {
  /**
   * Step-11A flag. "verified" means the caller is OK to proceed (either an
   * authenticated registered user, or a guest who has presented a valid
   * verification grant). "unverified" is rejected for guest bookings.
   * Step 11 always passes "verified" — gating arrives in Step 11A.
   */
  kind: "verified" | "unverified";
  /** Audit metadata only — opaque to this service. */
  grantId?: string;
}

export interface CreateBookingFromPublicArgs {
  tenant: TenantContext;
  body: BookingRequestInput;
  /** `null` when no bearer was supplied (guest mode). */
  authUser: RequestUser | null;
  /** Step-11A hook — Step 11 passes `{ kind: "verified" }`. */
  verificationContext?: VerificationContext;
}

export interface CreateBookingFromBusinessArgs {
  tenant: TenantContext;
  body: BusinessBookingCreateInput;
  actor: RequestUser;
}

export interface CreatedBookingResult {
  bookingId: string;
  /** Customer-facing start (NOT the buffer-inclusive blocked range). */
  startAt: string;
  endAt: string;
  staffMemberId: string;
  serviceId: string;
  customerId: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
}

// =============================================================================
// SERVICE
// =============================================================================

const MAX_SERIALIZATION_RETRIES = 3;
const EXCLUSION_CONSTRAINT_NAME = "bookings_no_overlap_per_staff";
const PG_SERIALIZATION_FAILURE = "40001";
const PG_EXCLUSION_VIOLATION = "23P01";

/**
 * Default new booking status. We use `confirmed` because the storefront
 * flow has no payment step that would justify `pending`. Tenant admin can
 * also override at the controller layer in the future if needed.
 */
const DEFAULT_BOOKING_STATUS: "confirmed" = "confirmed";

@Injectable()
export class BookingTransactionService {
  private readonly logger = new Logger(BookingTransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ownership: TenantOwnershipService,
    private readonly validator: TenantValidatorService,
    private readonly loader: AvailabilityLoaderService,
    private readonly audit: AuditLogService,
    private readonly bookingVerification: BookingVerificationService,
  ) {}

  // =========================================================================
  // PUBLIC ENTRY POINTS
  // =========================================================================

  /** Public storefront flow. Mode is in the body (auth vs guest). */
  async createFromPublic(
    args: CreateBookingFromPublicArgs,
  ): Promise<CreatedBookingResult> {
    const { tenant, body, authUser } = args;
    const verification = args.verificationContext ?? { kind: "verified" };

    // mode<->auth presence cross-check
    if (body.mode === "authenticated" && !authUser) {
      throw new BadRequestException(
        "Authenticated booking requires a bearer token",
      );
    }
    if (body.mode === "guest" && authUser) {
      throw new BadRequestException(
        "Guest booking conflicts with a present bearer token",
      );
    }

    // Step-11A hook: refuse unverified guest bookings.
    if (body.mode === "guest" && verification.kind === "unverified") {
      throw new ForbiddenException({
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email before completing this booking.",
      });
    }

    return this.runTransactionalCreate({
      tenant,
      serviceId: body.serviceId,
      staffSelector: body.staffId,
      startAtIso: body.startAt,
      customer:
        body.mode === "authenticated"
          ? { kind: "auth_user", user: authUser! }
          : { kind: "guest", details: body.guest },
      note: body.mode === "authenticated" ? body.note : body.guest.note,
      actorUserId: authUser?.userId,
      actorEmail: authUser?.email,
      source: "public",
      verificationGrantId: verification.grantId,
    });
  }

  /** Business dashboard flow. Customer is supplied by id OR as a new guest. */
  async createFromBusiness(
    args: CreateBookingFromBusinessArgs,
  ): Promise<CreatedBookingResult> {
    const { tenant, body, actor } = args;
    return this.runTransactionalCreate({
      tenant,
      serviceId: body.serviceId,
      staffSelector: body.staffId,
      startAtIso: body.startAt,
      customer:
        body.customerId !== undefined
          ? { kind: "existing_customer", customerId: body.customerId }
          : { kind: "guest", details: body.guest! },
      note: body.note,
      actorUserId: actor.userId,
      actorEmail: actor.email,
      source: "business",
    });
  }

  // =========================================================================
  // CORE — runs inside a SERIALIZABLE transaction with bounded retry
  // =========================================================================

  private async runTransactionalCreate(args: {
    tenant: TenantContext;
    serviceId: string;
    staffSelector: string; // uuid or "any"
    startAtIso: string;
    customer:
      | { kind: "auth_user"; user: RequestUser }
      | { kind: "existing_customer"; customerId: string }
      | {
          kind: "guest";
          details: {
            firstName: string;
            lastName: string;
            phone: string;
            email?: string;
            note?: string;
          };
        };
    note?: string;
    actorUserId?: string;
    actorEmail?: string;
    source: "public" | "business";
    verificationGrantId?: string;
  }): Promise<CreatedBookingResult> {
    // ---------------------------------------------------------------------
    // PRE-TX: Tenant info + service + staff resolution + recompute prep.
    // These reads don't NEED the SERIALIZABLE isolation; running them
    // outside the TX keeps the lock window short.
    // ---------------------------------------------------------------------
    const tenantRow = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: args.tenant.id },
      include: { settings: true },
    });
    if (!tenantRow.settings) {
      throw new InternalServerErrorException("Tenant settings missing");
    }
    const settings = tenantRow.settings;
    const tenantTz = tenantRow.timezone;

    // Service ownership (404 if cross-tenant).
    const service = await this.ownership.service(args.serviceId, args.tenant.id);

    // Guest allowance gate (public flow only).
    if (
      args.source === "public" &&
      args.customer.kind === "guest" &&
      !settings.allowGuestBooking
    ) {
      throw new ForbiddenException({
        code: "GUEST_BOOKING_DISABLED",
        message: "Guest booking is disabled for this business.",
      });
    }

    // Step 11A — authenticated-but-unverified policy. When the tenant
    // opts into `requireVerifiedAccountForBooking`, a registered user with
    // `emailVerified=false` is blocked. Guests are handled separately via
    // the OTP grant; this gate only matters for the auth_user customer path.
    if (
      args.source === "public" &&
      args.customer.kind === "auth_user" &&
      settings.requireVerifiedAccountForBooking
    ) {
      const userRow = await this.prisma.user.findUnique({
        where: { id: args.customer.user.userId },
        select: { emailVerified: true },
      });
      if (!userRow?.emailVerified) {
        throw new ForbiddenException({
          code: "EMAIL_NOT_VERIFIED",
          message:
            "Please verify your email address before completing a booking.",
        });
      }
    }

    // Resolve "any" → a specific qualifying staff member.
    const staffMemberId = await this.resolveStaffMember({
      tenant: args.tenant,
      service,
      staffSelector: args.staffSelector,
      startAtIso: args.startAtIso,
      tenantTz,
      settings,
    });

    // Validate staff↔service link (404 if not assigned to perform).
    await this.validator.assertStaffCanPerformService(
      staffMemberId,
      service.id,
      args.tenant.id,
    );

    // ---------------------------------------------------------------------
    // TX: SERIALIZABLE write with bounded retry on serialization failure.
    // ---------------------------------------------------------------------
    return this.withSerializableRetry(async () => {
      return this.prisma.$transaction(
        async (tx) => {
          // ── (1) Re-fetch existing active bookings INSIDE the tx so the
          //       SERIALIZABLE snapshot covers concurrent inserts.
          const dayBounds = computeDayBoundsUtc(args.startAtIso, tenantTz);
          const existing = await tx.booking.findMany({
            where: {
              tenantId: args.tenant.id,
              staffMemberId,
              status: { in: ["pending", "confirmed"] },
              startAt: { lt: dayBounds.end },
              endAt: { gt: dayBounds.start },
            },
            select: { id: true, startAt: true, endAt: true },
          });

          // ── (2) Resolve the date in tenant TZ for the loader.
          const dateStr = DateTime.fromISO(args.startAtIso, { zone: "utc" })
            .setZone(tenantTz)
            .toFormat("yyyy-LL-dd");

          // ── (3) Re-derive valid slots via the Step 9 engine.
          const resolved = await this.loader.loadAvailabilityConfigForDate({
            tenantId: args.tenant.id,
            staffMemberId,
            date: dateStr,
          });
          const slotDuration =
            resolved.windows[0]?.slotDurationMinutes ??
            settings.defaultSlotDurationMinutes;

          const engineResult = computeAvailableSlots({
            date: dateStr,
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
            minLeadTimeMinutes: settings.bookingLeadTimeMinutes,
            maxDaysAhead: settings.bookingMaxDaysAhead,
          });

          const wantedStartUtc = DateTime.fromISO(args.startAtIso, {
            zone: "utc",
          }).toUTC();
          const matchedSlot = engineResult.slots.find(
            (s) =>
              DateTime.fromISO(s.startUtc, { zone: "utc" }).equals(
                wantedStartUtc,
              ),
          );
          if (!matchedSlot) {
            // Generic message — never leak which specific check failed.
            throw new ConflictException({
              code: "SLOT_UNAVAILABLE",
              message: "That time is no longer available — please pick another.",
            });
          }

          // ── (4) STEP-11A HOOK POINT
          //       Per the Step 11 spec, this is exactly where the verification
          //       gate plugs in. Step 11 enforces no extra check beyond what
          //       was already done at the entry point; Step 11A's logic
          //       (lookup of `verificationGrantId`, single-use consumption,
          //       email match against the guest body) lives here so it
          //       happens after recompute and before customer insert.

          // ── (5) Resolve or insert customer.
          const customerId = await this.resolveCustomer({
            tx,
            tenantId: args.tenant.id,
            tenantTz,
            customer: args.customer,
          });

          // ── (6) Insert booking with buffer-inclusive blocked range.
          const customerStart = wantedStartUtc.toJSDate();
          const customerEnd = wantedStartUtc
            .plus({ minutes: service.durationMinutes })
            .toJSDate();
          const blockedStart = wantedStartUtc
            .minus({ minutes: service.bufferBeforeMinutes })
            .toJSDate();
          const blockedEnd = wantedStartUtc
            .plus({
              minutes:
                service.durationMinutes + service.bufferAfterMinutes,
            })
            .toJSDate();

          let booking: Booking;
          try {
            booking = await tx.booking.create({
              data: {
                tenantId: args.tenant.id,
                staffMemberId,
                serviceId: service.id,
                customerId,
                startAt: blockedStart,
                endAt: blockedEnd,
                status: DEFAULT_BOOKING_STATUS,
              },
            });
          } catch (err) {
            // Exclusion constraint loss → friendly 409.
            if (isExclusionViolation(err)) {
              throw new ConflictException({
                code: "SLOT_TAKEN",
                message:
                  "That time was just taken by another booking — please pick another.",
              });
            }
            throw err;
          }

          // ── (6b) Step 11A: consume the guest verification grant AFTER
          //        the insert succeeds. Doing it here means a 409 (taken)
          //        rolls back the consume too, so the guest can retry with
          //        another slot without re-OTP'ing.
          if (args.verificationGrantId) {
            await this.bookingVerification.consumeGrant(
              tx,
              args.verificationGrantId,
            );
          }

          // ── (7) Audit log (in-tx for reliability — rolls back if insert
          //       above somehow fails downstream).
          await tx.bookingAuditLog.create({
            data: {
              tenantId: args.tenant.id,
              bookingId: booking.id,
              actorUserId: args.actorUserId ?? null,
              action: "booking.create",
              metadata: {
                source: args.source,
                actorEmail: args.actorEmail ?? null,
                staffMemberId,
                serviceId: service.id,
                startAtUtc: customerStart.toISOString(),
                endAtUtc: customerEnd.toISOString(),
                verificationGrantId: args.verificationGrantId ?? null,
              } as Prisma.JsonObject,
            },
          });

          // ── (8) Notification event (in-tx so it's reliably enqueued).
          await tx.notificationEvent.create({
            data: {
              tenantId: args.tenant.id,
              bookingId: booking.id,
              type: "booking.confirmed",
              status: "pending",
              payload: {
                bookingId: booking.id,
                tenantSlug: args.tenant.slug,
                staffMemberId,
                serviceId: service.id,
                startAtUtc: customerStart.toISOString(),
              } as Prisma.JsonObject,
            },
          });

          return {
            bookingId: booking.id,
            startAt: customerStart.toISOString(),
            endAt: customerEnd.toISOString(),
            staffMemberId,
            serviceId: service.id,
            customerId,
            status: booking.status,
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10_000,
          maxWait: 5_000,
        },
      );
    });
  }

  // =========================================================================
  // INTERNAL HELPERS
  // =========================================================================

  /**
   * Resolves "any" → a concrete qualifying staff id by running the engine
   * for each staff member who CAN perform the service, then picking the
   * first one whose schedule contains the requested time. Returns 409 if
   * no qualifying staff has the slot.
   *
   * Read-only — runs BEFORE the SERIALIZABLE TX so we don't widen the lock
   * window. The TX will recompute again under SERIALIZABLE for the chosen
   * staff member, so a race between pre-resolve and TX gets caught by the
   * exclusion constraint.
   */
  private async resolveStaffMember(args: {
    tenant: TenantContext;
    service: Service;
    staffSelector: string;
    startAtIso: string;
    tenantTz: string;
    settings: TenantSettings;
  }): Promise<string> {
    if (args.staffSelector !== ANY_STAFF) {
      // Explicit staff requested — verify ownership now and return.
      await this.ownership.staffMember(args.staffSelector, args.tenant.id);
      return args.staffSelector;
    }
    // "any" — find every staff member who can perform this service.
    const candidates = await this.prisma.staffService.findMany({
      where: {
        tenantId: args.tenant.id,
        serviceId: args.service.id,
        staffMember: { isActive: true },
      },
      select: { staffMemberId: true },
    });
    if (candidates.length === 0) {
      throw new ConflictException({
        code: "NO_STAFF",
        message: "No staff are available for this service.",
      });
    }
    const dateStr = DateTime.fromISO(args.startAtIso, { zone: "utc" })
      .setZone(args.tenantTz)
      .toFormat("yyyy-LL-dd");
    const wanted = DateTime.fromISO(args.startAtIso, { zone: "utc" }).toUTC();
    for (const c of candidates) {
      const resolved = await this.loader.loadAvailabilityConfigForDate({
        tenantId: args.tenant.id,
        staffMemberId: c.staffMemberId,
        date: dateStr,
      });
      const slotDuration =
        resolved.windows[0]?.slotDurationMinutes ??
        args.settings.defaultSlotDurationMinutes;
      const existing = await this.prisma.booking.findMany({
        where: {
          tenantId: args.tenant.id,
          staffMemberId: c.staffMemberId,
          status: { in: ["pending", "confirmed"] },
        },
        select: { startAt: true, endAt: true },
      });
      const r = computeAvailableSlots({
        date: dateStr,
        tenantTimezone: args.tenantTz,
        windows: resolved.windows,
        breaks: resolved.breaks,
        slotDurationMinutes: slotDuration,
        serviceDurationMinutes: args.service.durationMinutes,
        bufferBeforeMinutes: args.service.bufferBeforeMinutes,
        bufferAfterMinutes: args.service.bufferAfterMinutes,
        existingBookings: existing.map((b) => ({
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
        })),
        minLeadTimeMinutes: args.settings.bookingLeadTimeMinutes,
        maxDaysAhead: args.settings.bookingMaxDaysAhead,
      });
      if (
        r.slots.some((s) =>
          DateTime.fromISO(s.startUtc, { zone: "utc" }).equals(wanted),
        )
      ) {
        return c.staffMemberId;
      }
    }
    throw new ConflictException({
      code: "SLOT_UNAVAILABLE",
      message: "That time is no longer available — please pick another.",
    });
  }

  /**
   * Insert or look up the customer row that the booking will attach to.
   * Tenant-scoped — a User who has booked at multiple tenants has multiple
   * Customer rows, one per tenant.
   */
  private async resolveCustomer(args: {
    tx: Prisma.TransactionClient;
    tenantId: string;
    tenantTz: string;
    customer:
      | { kind: "auth_user"; user: RequestUser }
      | { kind: "existing_customer"; customerId: string }
      | {
          kind: "guest";
          details: {
            firstName: string;
            lastName: string;
            phone: string;
            email?: string;
            note?: string;
          };
        };
  }): Promise<string> {
    const { tx, tenantId, customer } = args;
    if (customer.kind === "existing_customer") {
      // Business admin path. Confirm ownership inside the tx so it
      // participates in the SERIALIZABLE snapshot.
      const row = await tx.customer.findFirst({
        where: { id: customer.customerId, tenantId },
        select: { id: true },
      });
      if (!row) throw new NotFoundException("Customer not found");
      return row.id;
    }
    if (customer.kind === "auth_user") {
      // Reuse existing tenant-scoped customer row for this user, or create one.
      const existing = await tx.customer.findFirst({
        where: { tenantId, userId: customer.user.userId },
        select: { id: true },
      });
      if (existing) return existing.id;
      const user = await tx.user.findUnique({
        where: { id: customer.user.userId },
        select: { firstName: true, lastName: true, email: true },
      });
      const created = await tx.customer.create({
        data: {
          tenantId,
          userId: customer.user.userId,
          firstName: user?.firstName ?? "Customer",
          lastName: user?.lastName ?? customer.user.email.split("@")[0]!,
          // Authenticated customers don't necessarily have a phone on file
          // (Step 4 register doesn't ask). Use a tagged placeholder so the
          // NOT NULL constraint is satisfied; admins can edit later.
          phone: `+0${randomBytes(6).readUIntBE(0, 6)}`.slice(0, 16),
          email: user?.email ?? customer.user.email,
        },
        select: { id: true },
      });
      return created.id;
    }
    // Guest path — always create a fresh Customer row for a guest booking
    // (no dedupe by email). Admins can merge later if desired.
    const created = await tx.customer.create({
      data: {
        tenantId,
        firstName: customer.details.firstName,
        lastName: customer.details.lastName,
        phone: customer.details.phone,
        email: customer.details.email ?? null,
        note: customer.details.note ?? null,
      },
      select: { id: true },
    });
    return created.id;
  }

  private async withSerializableRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_SERIALIZATION_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err) {
        if (isSerializationFailure(err)) {
          lastError = err;
          this.logger.warn(
            `Serialization failure (attempt ${attempt}/${MAX_SERIALIZATION_RETRIES}) — retrying`,
          );
          await sleep(50 * attempt); // simple linear backoff
          continue;
        }
        throw err;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new ConflictException({
          code: "BOOKING_RETRY_EXHAUSTED",
          message:
            "Too many concurrent booking attempts — please try again in a moment.",
        });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function isExclusionViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const message =
    "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  if (message.includes(EXCLUSION_CONSTRAINT_NAME)) return true;
  // Postgres exclusion_violation, surfaced via raw error or PrismaClientUnknownRequestError
  const code = (err as { code?: unknown }).code;
  if (code === PG_EXCLUSION_VIOLATION) return true;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    // Defensive — exclusion is reported by Postgres but Prisma may map a
    // related case to P2002 in some versions.
    return true;
  }
  return false;
}

function isSerializationFailure(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  if (code === PG_SERIALIZATION_FAILURE) return true;
  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2034"
  ) {
    return true;
  }
  const message =
    "message" in err && typeof (err as { message: unknown }).message === "string"
      ? (err as { message: string }).message
      : "";
  return /could not serialize access|serialization failure/i.test(message);
}

function computeDayBoundsUtc(
  startAtIso: string,
  zone: string,
): { start: Date; end: Date } {
  const localDay = DateTime.fromISO(startAtIso, { zone: "utc" })
    .setZone(zone)
    .startOf("day");
  return {
    start: localDay.toUTC().toJSDate(),
    end: localDay.plus({ days: 1 }).toUTC().toJSDate(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
