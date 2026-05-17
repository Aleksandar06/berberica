import { z } from "zod";

import {
  isoDateIsTodayOrFuture,
  isoDateSchema,
  phoneSchema,
  uuidSchema,
} from "./primitives";

// "any" sentinel: client doesn't care which staff member, server picks one.
export const ANY_STAFF = "any" as const;

const staffSelectorSchema = z.union([uuidSchema, z.literal(ANY_STAFF)]);

// ===========================================================================
// PUBLIC AVAILABILITY QUERY
// ===========================================================================
// Tenant slug is resolved from the URL path (not the body) so isolation can't
// be bypassed by altering the payload — schema validates the rest of the
// query only.

export const publicAvailabilityQuerySchema = z.object({
  serviceId: uuidSchema,
  staffId: staffSelectorSchema.default(ANY_STAFF),
  date: isoDateSchema.refine(
    isoDateIsTodayOrFuture,
    "date cannot be in the past",
  ),
});
export type PublicAvailabilityQuery = z.infer<
  typeof publicAvailabilityQuerySchema
>;

// ===========================================================================
// BOOKING REQUEST (public)
// ===========================================================================
// Discriminated by `mode`:
//   • "authenticated" → customer resolved server-side from session
//   • "guest"         → guest details captured here, Customer row upserted
// `allowGuestBooking` enforcement happens server-side against tenant settings.

export const guestCustomerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email")
    .max(320)
    .optional(),
  note: z.string().trim().max(2000).optional(),
});
export type GuestCustomerInput = z.infer<typeof guestCustomerSchema>;

export const bookingRequestInputSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("authenticated"),
    serviceId: uuidSchema,
    staffId: staffSelectorSchema.default(ANY_STAFF),
    startAt: z
      .string()
      .datetime({ offset: true, message: "startAt must be ISO 8601 with timezone offset" }),
    note: z.string().trim().max(2000).optional(),
  }),
  z.object({
    mode: z.literal("guest"),
    serviceId: uuidSchema,
    staffId: staffSelectorSchema.default(ANY_STAFF),
    startAt: z
      .string()
      .datetime({ offset: true, message: "startAt must be ISO 8601 with timezone offset" }),
    guest: guestCustomerSchema,
    /**
     * Step 11A: OTP grant token returned by `/bookings/verify/confirm`. The
     * server enforces presence + matches against the guest's email + the
     * resolved tenant. Optional here so the SHAPE is back-compat — the
     * public bookings controller rejects guests who omit it.
     */
    verificationGrant: z.string().min(1).max(1024).optional(),
  }),
]);
export type BookingRequestInput = z.infer<typeof bookingRequestInputSchema>;

// ===========================================================================
// BOOKING CANCEL / RESCHEDULE
// ===========================================================================

export const bookingCancelInputSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
export type BookingCancelInput = z.infer<typeof bookingCancelInputSchema>;

export const bookingRescheduleInputSchema = z.object({
  newStartAt: z
    .string()
    .datetime({ offset: true, message: "newStartAt must be ISO 8601 with timezone offset" }),
  reason: z.string().trim().max(500).optional(),
});
export type BookingRescheduleInput = z.infer<
  typeof bookingRescheduleInputSchema
>;

// ===========================================================================
// BOOKING STATUS CHANGE (mark arrived / no-show / completed)
// ===========================================================================
// Lets a tenant admin / staff member flip a booking through its non-cancel
// status lifecycle: pending → confirmed (arrived) → completed, OR pending →
// no_show. Cancellation goes through the dedicated `/cancel` endpoint
// because it carries a reason field and emits its own notification.

export const bookingSetStatusInputSchema = z.object({
  status: z.enum(["confirmed", "completed", "no_show"]),
});
export type BookingSetStatusInput = z.infer<typeof bookingSetStatusInputSchema>;

// ===========================================================================
// BUSINESS BOOKING CREATE — tenant admin / staff creating on behalf
// ===========================================================================
// Differs from `bookingRequestInputSchema` in that the customer can be:
//   • an existing tenant-scoped customer (by `customerId`), OR
//   • a brand new guest customer to be created in this transaction.
// Exactly one of the two must be provided.
// ===========================================================================

const adminGuestCustomerSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: phoneSchema,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email")
    .max(320)
    .optional(),
  note: z.string().trim().max(2000).optional(),
});

export const businessBookingCreateInputSchema = z
  .object({
    serviceId: uuidSchema,
    staffId: z.union([uuidSchema, z.literal(ANY_STAFF)]).default(ANY_STAFF),
    startAt: z
      .string()
      .datetime({ offset: true, message: "startAt must be ISO 8601 with timezone offset" }),
    customerId: uuidSchema.optional(),
    guest: adminGuestCustomerSchema.optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .refine(
    (d) => (d.customerId !== undefined) !== (d.guest !== undefined),
    {
      message: "Provide either customerId OR guest (not both, not neither)",
      path: ["customerId"],
    },
  );
export type BusinessBookingCreateInput = z.infer<
  typeof businessBookingCreateInputSchema
>;

// ===========================================================================
// LISTING QUERIES
// ===========================================================================

export const businessBookingsListQuerySchema = z.object({
  staffMemberId: uuidSchema.optional(),
  status: z
    .enum(["pending", "confirmed", "cancelled", "completed", "no_show"])
    .optional(),
  fromDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "fromDate must be YYYY-MM-DD")
    .optional(),
  toDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "toDate must be YYYY-MM-DD")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type BusinessBookingsListQuery = z.infer<
  typeof businessBookingsListQuerySchema
>;
