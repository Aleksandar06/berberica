import { Injectable, NotFoundException } from "@nestjs/common";
import type {
  AvailabilityBreak,
  AvailabilityException,
  AvailabilityExceptionBreak,
  AvailabilityRule,
  Booking,
  BookingAuditLog,
  Customer,
  NotificationEvent,
  Prisma,
  Service,
  StaffMember,
  StaffService,
  TenantBrandingAssets,
  TenantSettings,
} from "@prisma/client";

import { PrismaService } from "../../prisma/prisma.service";

/**
 * Closed enumeration of every tenant-owned Prisma model. Adding a new
 * tenant-scoped table means:
 *   1. add it to the Prisma schema with `tenantId`,
 *   2. add its name here,
 *   3. add it to the runtime delegate map below,
 *   4. (optional) add a typed wrapper on TenantOwnershipService.
 *
 * The compiler then refuses any cross-tenant query that doesn't pass
 * through this service.
 */
export type TenantOwnedModelName =
  | "tenantSettings"
  | "tenantBrandingAssets"
  | "service"
  | "staffMember"
  | "staffService"
  | "availabilityRule"
  | "availabilityBreak"
  | "availabilityException"
  | "availabilityExceptionBreak"
  | "customer"
  | "booking"
  | "bookingAuditLog"
  | "notificationEvent";

/** Output type for each model, keyed by enum value. Drives the typed wrappers. */
export interface TenantOwnedModelMap {
  tenantSettings: TenantSettings;
  tenantBrandingAssets: TenantBrandingAssets;
  service: Service;
  staffMember: StaffMember;
  staffService: StaffService;
  availabilityRule: AvailabilityRule;
  availabilityBreak: AvailabilityBreak;
  availabilityException: AvailabilityException;
  availabilityExceptionBreak: AvailabilityExceptionBreak;
  customer: Customer;
  booking: Booking;
  bookingAuditLog: BookingAuditLog;
  notificationEvent: NotificationEvent;
}

/**
 * IDOR-proof record lookup. THIS IS THE ONLY APPROVED WAY for later steps
 * to fetch a tenant-scoped record by id.
 *
 * Why this exists (read carefully — every later CRUD service depends on it):
 *
 *   • Direct `prisma.booking.findUnique({ where: { id } })` works on JUST id
 *     and would happily return a row owned by ANOTHER tenant. That is the
 *     textbook IDOR bug.
 *   • This service filters by `id AND tenantId`, and translates "no row"
 *     into a 404. Tenant A asking for tenant B's record is indistinguishable
 *     from asking for a record that doesn't exist — no existence leak.
 *   • The enum + map design refuses (at compile time) calls against
 *     non-tenant-owned models like User / Tenant / RefreshToken. Those have
 *     their own auth boundaries.
 *   • No raw SQL anywhere — Prisma's parameterized queries only.
 *
 * Usage:
 *
 *   const booking = await ownership.assert("booking", id, tenant.id);
 *   const booking = await ownership.booking(id, tenant.id);  // typed shortcut
 */
@Injectable()
export class TenantOwnershipService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // GENERIC
  // ---------------------------------------------------------------------------

  /**
   * Fetches a record by id + tenantId. Throws NotFoundException if the
   * record is missing OR belongs to a different tenant. Both branches return
   * the SAME error, by design — never reveal cross-tenant existence.
   */
  async assert<M extends TenantOwnedModelName>(
    model: M,
    recordId: string,
    tenantId: string,
  ): Promise<TenantOwnedModelMap[M]> {
    const delegate = this.delegateFor(model);
    // Prisma's findFirst is the right choice here: findUnique requires a
    // unique key (just `id`), which would defeat the tenant filter.
    const row = await delegate.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!row) {
      throw new NotFoundException("Not found");
    }
    return row as TenantOwnedModelMap[M];
  }

  /**
   * Same semantics as `assert` but returns null instead of throwing. Useful
   * when the caller wants to chain into other lookups before deciding 404.
   */
  async find<M extends TenantOwnedModelName>(
    model: M,
    recordId: string,
    tenantId: string,
  ): Promise<TenantOwnedModelMap[M] | null> {
    const delegate = this.delegateFor(model);
    const row = await delegate.findFirst({
      where: { id: recordId, tenantId },
    });
    return (row ?? null) as TenantOwnedModelMap[M] | null;
  }

  // ---------------------------------------------------------------------------
  // TYPED WRAPPERS — preferred for new code; pure ergonomics over `assert`.
  // ---------------------------------------------------------------------------

  service(id: string, tenantId: string): Promise<Service> {
    return this.assert("service", id, tenantId);
  }
  staffMember(id: string, tenantId: string): Promise<StaffMember> {
    return this.assert("staffMember", id, tenantId);
  }
  staffService(id: string, tenantId: string): Promise<StaffService> {
    return this.assert("staffService", id, tenantId);
  }
  availabilityRule(id: string, tenantId: string): Promise<AvailabilityRule> {
    return this.assert("availabilityRule", id, tenantId);
  }
  availabilityBreak(id: string, tenantId: string): Promise<AvailabilityBreak> {
    return this.assert("availabilityBreak", id, tenantId);
  }
  availabilityException(
    id: string,
    tenantId: string,
  ): Promise<AvailabilityException> {
    return this.assert("availabilityException", id, tenantId);
  }
  availabilityExceptionBreak(
    id: string,
    tenantId: string,
  ): Promise<AvailabilityExceptionBreak> {
    return this.assert("availabilityExceptionBreak", id, tenantId);
  }
  customer(id: string, tenantId: string): Promise<Customer> {
    return this.assert("customer", id, tenantId);
  }
  booking(id: string, tenantId: string): Promise<Booking> {
    return this.assert("booking", id, tenantId);
  }
  bookingAuditLog(id: string, tenantId: string): Promise<BookingAuditLog> {
    return this.assert("bookingAuditLog", id, tenantId);
  }
  notificationEvent(
    id: string,
    tenantId: string,
  ): Promise<NotificationEvent> {
    return this.assert("notificationEvent", id, tenantId);
  }

  // ---------------------------------------------------------------------------

  /**
   * Maps a model-name string to the Prisma delegate. `unknown` shrink-wraps
   * the Prisma generic types we don't need to expose to callers; the public
   * `assert<M>` signature provides the precise return type via the map.
   */
  private delegateFor(model: TenantOwnedModelName): {
    findFirst: (args: {
      where: { id: string; tenantId: string };
    }) => Promise<unknown>;
  } {
    // The `as` casts are safe: every key here is verified by the
    // TenantOwnedModelName type, and each delegate accepts findFirst with
    // a `where` of { id, tenantId } because the underlying tables all have
    // both columns (enforced by the Prisma schema).
    const map: Record<
      TenantOwnedModelName,
      Prisma.ServiceDelegate | unknown
    > = {
      tenantSettings: this.prisma.tenantSettings,
      tenantBrandingAssets: this.prisma.tenantBrandingAssets,
      service: this.prisma.service,
      staffMember: this.prisma.staffMember,
      staffService: this.prisma.staffService,
      availabilityRule: this.prisma.availabilityRule,
      availabilityBreak: this.prisma.availabilityBreak,
      availabilityException: this.prisma.availabilityException,
      availabilityExceptionBreak: this.prisma.availabilityExceptionBreak,
      customer: this.prisma.customer,
      booking: this.prisma.booking,
      bookingAuditLog: this.prisma.bookingAuditLog,
      notificationEvent: this.prisma.notificationEvent,
    };
    return map[model] as {
      findFirst: (args: {
        where: { id: string; tenantId: string };
      }) => Promise<unknown>;
    };
  }
}
