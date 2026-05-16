/**
 * Public storefront API client. Every function here is tenant-slug scoped
 * and hits `/api/public/:tenantSlug/...`. None of these endpoints require
 * a bearer (guest-friendly), though `MaybeJwtAuthGuard` on the server lets
 * an optional bearer flow through.
 */
import type {
  BookingConfirmation,
  BookingRequestInput,
  GuestOtpConfirmInput,
  GuestOtpRequestInput,
  OtpConfirmResponse,
  PublicAvailabilityResponse,
  PublicService,
  PublicStaffMember,
  PublicTenantProfile,
} from "./types";
import { apiFetch } from "./client";

const enc = encodeURIComponent;

export const publicApi = {
  // ===========================================================================
  // READS
  // ===========================================================================

  /**
   * Used by the [tenantSlug] layout as an SSR fetch so brand colors land on
   * first paint. `revalidate: 60` keeps the network call off the critical
   * path for repeat visitors without holding stale data more than a minute.
   */
  getProfile(
    tenantSlug: string,
    opts?: { revalidateSeconds?: number },
  ): Promise<PublicTenantProfile> {
    return apiFetch<PublicTenantProfile>(
      `/api/public/${enc(tenantSlug)}/profile`,
      { next: { revalidate: opts?.revalidateSeconds ?? 60 } },
    );
  },

  getServices(tenantSlug: string): Promise<PublicService[]> {
    return apiFetch<PublicService[]>(
      `/api/public/${enc(tenantSlug)}/services`,
      { next: { revalidate: 60 } },
    );
  },

  getStaff(tenantSlug: string): Promise<PublicStaffMember[]> {
    return apiFetch<PublicStaffMember[]>(
      `/api/public/${enc(tenantSlug)}/staff`,
      { next: { revalidate: 60 } },
    );
  },

  /**
   * Availability — called by the booking flow. Not cached on the server
   * side (TanStack Query handles client-side caching with refetch-on-focus).
   */
  getAvailability(
    tenantSlug: string,
    params: { serviceId: string; staffId: string; date: string },
  ): Promise<PublicAvailabilityResponse> {
    const qs = new URLSearchParams({
      serviceId: params.serviceId,
      staffId: params.staffId,
      date: params.date,
    });
    return apiFetch<PublicAvailabilityResponse>(
      `/api/public/${enc(tenantSlug)}/availability?${qs.toString()}`,
      { cache: "no-store" },
    );
  },

  // ===========================================================================
  // OTP (Step 11A)
  // ===========================================================================

  requestOtp(
    tenantSlug: string,
    body: GuestOtpRequestInput,
  ): Promise<{ ok: true }> {
    return apiFetch<{ ok: true }>(
      `/api/public/${enc(tenantSlug)}/bookings/verify/request`,
      { method: "POST", body },
    );
  },

  confirmOtp(
    tenantSlug: string,
    body: GuestOtpConfirmInput,
  ): Promise<OtpConfirmResponse> {
    return apiFetch<OtpConfirmResponse>(
      `/api/public/${enc(tenantSlug)}/bookings/verify/confirm`,
      { method: "POST", body },
    );
  },

  // ===========================================================================
  // BOOKING
  // ===========================================================================

  createBooking(
    tenantSlug: string,
    body: BookingRequestInput,
  ): Promise<BookingConfirmation> {
    return apiFetch<BookingConfirmation>(
      `/api/public/${enc(tenantSlug)}/bookings`,
      { method: "POST", body },
    );
  },
};
