/**
 * Authenticated business endpoints (TENANT_ADMIN of the resolved tenant).
 * Tenant is derived server-side from the session (BusinessTenantGuard) —
 * never passed in the body.
 */
import { authedFetch } from "./authed-client";

// =============================================================================
// PROFILE / SETTINGS / BRANDING
// =============================================================================

export interface BusinessProfile {
  id: string;
  slug: string;
  name: string;
  businessType: string;
  timezone: string;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  status: "active" | "suspended";
}

export interface BusinessSettings {
  id: string;
  tenantId: string;
  defaultSlotDurationMinutes: number;
  bookingLeadTimeMinutes: number;
  bookingMaxDaysAhead: number;
  allowGuestBooking: boolean;
  allowCustomerCancellation: boolean;
  cancellationCutoffMinutes: number;
  allowCustomerReschedule: boolean;
  rescheduleCutoffMinutes: number;
  cancellationPolicy: string | null;
  reschedulePolicy: string | null;
  requireVerifiedAccountForBooking: boolean;
}

export interface BusinessBranding {
  id: string;
  tenantId: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
}

// =============================================================================
// SERVICES
// =============================================================================

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  isActive: boolean;
}

// =============================================================================
// STAFF
// =============================================================================

export interface StaffMember {
  id: string;
  tenantId: string;
  userId: string | null;
  displayName: string;
  isActive: boolean;
}

// =============================================================================
// AVAILABILITY
// =============================================================================

export interface AvailabilityRule {
  id: string;
  tenantId: string;
  staffMemberId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number | null;
  isActive: boolean;
}

export interface AvailabilityBreak {
  id: string;
  tenantId: string;
  staffMemberId: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

export interface AvailabilityException {
  id: string;
  tenantId: string;
  staffMemberId: string | null;
  exceptionDate: string;
  isClosed: boolean;
  customStartTime: string | null;
  customEndTime: string | null;
  reason: string | null;
}

export interface AvailabilityExceptionBreak {
  id: string;
  tenantId: string;
  staffMemberId: string | null;
  exceptionDate: string;
  startTime: string;
  endTime: string;
  reason: string | null;
}

export interface AvailabilityAggregate {
  rules: AvailabilityRule[];
  breaks: AvailabilityBreak[];
  exceptions: AvailabilityException[];
  exceptionBreaks: AvailabilityExceptionBreak[];
}

export interface CapacityPreview {
  workingMinutes: number;
  breakMinutes: number;
  netBookableMinutes: number;
  slotDurationMinutes: number;
  serviceDurationMinutes: number;
  possibleStartTimes: string[];
  validStartTimes: string[];
  invalidStartTimes: Array<{ time: string; reason: string }>;
  maxNonOverlappingBookings: number;
  warnings: string[];
  suggestions: string[];
}

// =============================================================================
// BOOKINGS
// =============================================================================

export interface BusinessBooking {
  id: string;
  tenantId: string;
  staffMemberId: string;
  serviceId: string;
  customerId: string;
  startAt: string;
  endAt: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
  };
  staffMember: { id: string; displayName: string };
  service: { id: string; name: string; durationMinutes: number };
}

export interface BusinessBookingsResponse {
  items: BusinessBooking[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// =============================================================================
// API
// =============================================================================

export const businessApi = {
  profile: {
    get: () => authedFetch<BusinessProfile>("/api/business/profile"),
    update: (body: Partial<Omit<BusinessProfile, "id" | "slug" | "status">>) =>
      authedFetch<BusinessProfile>("/api/business/profile", {
        method: "PATCH",
        body,
      }),
  },
  settings: {
    get: () => authedFetch<BusinessSettings>("/api/business/settings"),
    update: (body: Partial<Omit<BusinessSettings, "id" | "tenantId">>) =>
      authedFetch<BusinessSettings>("/api/business/settings", {
        method: "PATCH",
        body,
      }),
  },
  branding: {
    get: () => authedFetch<BusinessBranding>("/api/business/branding"),
    update: (body: Partial<Omit<BusinessBranding, "id" | "tenantId">>) =>
      authedFetch<BusinessBranding>("/api/business/branding", {
        method: "PATCH",
        body,
      }),
  },
  services: {
    list: (opts?: { isActive?: boolean }) => {
      const qs = new URLSearchParams();
      if (opts?.isActive !== undefined)
        qs.set("isActive", String(opts.isActive));
      return authedFetch<Service[]>(
        `/api/business/services${qs.toString() ? "?" + qs.toString() : ""}`,
      );
    },
    create: (body: Omit<Service, "id" | "tenantId">) =>
      authedFetch<Service>("/api/business/services", {
        method: "POST",
        body,
      }),
    update: (id: string, body: Partial<Omit<Service, "id" | "tenantId">>) =>
      authedFetch<Service>(`/api/business/services/${id}`, {
        method: "PATCH",
        body,
      }),
    delete: (id: string) =>
      authedFetch<Service>(`/api/business/services/${id}`, {
        method: "DELETE",
      }),
  },
  staff: {
    list: (opts?: { isActive?: boolean }) => {
      const qs = new URLSearchParams();
      if (opts?.isActive !== undefined)
        qs.set("isActive", String(opts.isActive));
      return authedFetch<StaffMember[]>(
        `/api/business/staff${qs.toString() ? "?" + qs.toString() : ""}`,
      );
    },
    create: (body: { displayName: string; userId?: string | null; isActive?: boolean }) =>
      authedFetch<StaffMember>("/api/business/staff", {
        method: "POST",
        body,
      }),
    update: (id: string, body: Partial<{ displayName: string; userId: string | null; isActive: boolean }>) =>
      authedFetch<StaffMember>(`/api/business/staff/${id}`, {
        method: "PATCH",
        body,
      }),
    delete: (id: string) =>
      authedFetch<StaffMember>(`/api/business/staff/${id}`, {
        method: "DELETE",
      }),
    listAssignedServices: (id: string) =>
      authedFetch<Service[]>(`/api/business/staff/${id}/services`),
    replaceServices: (id: string, serviceIds: string[]) =>
      authedFetch<Service[]>(`/api/business/staff/${id}/services`, {
        method: "PUT",
        body: { serviceIds },
      }),
  },
  availability: {
    aggregate: (staffMemberId?: string) => {
      const qs = staffMemberId
        ? `?staffMemberId=${encodeURIComponent(staffMemberId)}`
        : "";
      return authedFetch<AvailabilityAggregate>(
        `/api/business/availability${qs}`,
      );
    },
    capacityPreview: (params: {
      staffMemberId: string;
      serviceId: string;
      date: string;
      mode: "theoretical" | "real_day";
    }) => {
      const qs = new URLSearchParams({
        staffMemberId: params.staffMemberId,
        serviceId: params.serviceId,
        date: params.date,
        mode: params.mode,
      });
      return authedFetch<CapacityPreview>(
        `/api/business/availability/capacity-preview?${qs.toString()}`,
      );
    },
    createRule: (body: {
      staffMemberId?: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      slotDurationMinutes?: number | null;
      isActive?: boolean;
    }) =>
      authedFetch<AvailabilityRule>("/api/business/availability/rules", {
        method: "POST",
        body,
      }),
    deleteRule: (id: string) =>
      authedFetch<{ id: string }>(`/api/business/availability/rules/${id}`, {
        method: "DELETE",
      }),
    createBreak: (body: {
      staffMemberId?: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isActive?: boolean;
    }) =>
      authedFetch<AvailabilityBreak>("/api/business/availability/breaks", {
        method: "POST",
        body,
      }),
    deleteBreak: (id: string) =>
      authedFetch<{ id: string }>(`/api/business/availability/breaks/${id}`, {
        method: "DELETE",
      }),
    createException: (body: {
      staffMemberId?: string | null;
      exceptionDate: string;
      isClosed: boolean;
      customStartTime?: string | null;
      customEndTime?: string | null;
      reason?: string | null;
    }) =>
      authedFetch<AvailabilityException>(
        "/api/business/availability/exceptions",
        { method: "POST", body },
      ),
    deleteException: (id: string) =>
      authedFetch<{ id: string }>(
        `/api/business/availability/exceptions/${id}`,
        { method: "DELETE" },
      ),
  },
  bookings: {
    list: (params: {
      page?: number;
      pageSize?: number;
      staffMemberId?: string;
      status?: string;
      fromDate?: string;
      toDate?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params.page) qs.set("page", String(params.page));
      if (params.pageSize) qs.set("pageSize", String(params.pageSize));
      if (params.staffMemberId) qs.set("staffMemberId", params.staffMemberId);
      if (params.status) qs.set("status", params.status);
      if (params.fromDate) qs.set("fromDate", params.fromDate);
      if (params.toDate) qs.set("toDate", params.toDate);
      return authedFetch<BusinessBookingsResponse>(
        `/api/business/bookings${qs.toString() ? "?" + qs.toString() : ""}`,
      );
    },
    cancel: (id: string, reason?: string) =>
      authedFetch<BusinessBooking>(`/api/business/bookings/${id}/cancel`, {
        method: "POST",
        body: { reason },
      }),
    reschedule: (id: string, newStartAt: string, reason?: string) =>
      authedFetch<BusinessBooking>(
        `/api/business/bookings/${id}/reschedule`,
        { method: "POST", body: { newStartAt, reason } },
      ),
  },
};
