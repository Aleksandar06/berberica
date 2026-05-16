/**
 * Authenticated customer endpoints — `/api/customer/bookings/*`. No tenant
 * guard: bookings are filtered server-side via the customer's User → Customer
 * join, so a customer with bookings at multiple tenants sees them all here.
 */
import { authedFetch } from "./authed-client";

export interface CustomerBooking {
  id: string;
  tenantId: string;
  staffMemberId: string;
  serviceId: string;
  customerId: string;
  startAt: string;
  endAt: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  tenant: { id: string; slug: string; name: string; timezone: string };
  service: { id: string; name: string; durationMinutes: number };
  staffMember: { id: string; displayName: string };
}

export const customerApi = {
  list: () => authedFetch<CustomerBooking[]>("/api/customer/bookings"),
  cancel: (id: string, reason?: string) =>
    authedFetch<CustomerBooking>(`/api/customer/bookings/${id}/cancel`, {
      method: "POST",
      body: { reason },
    }),
  reschedule: (id: string, newStartAt: string, reason?: string) =>
    authedFetch<CustomerBooking>(`/api/customer/bookings/${id}/reschedule`, {
      method: "POST",
      body: { newStartAt, reason },
    }),
};
