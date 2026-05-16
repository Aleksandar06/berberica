import { z } from "zod";

import { emailSchema, uuidSchema } from "./primitives";

// ===========================================================================
// ACCOUNT EMAIL VERIFICATION (Step 11A)
// ===========================================================================

/**
 * Token comes from the verification email link. High-entropy random
 * (≥256 bits) → fits in a single string. We accept any non-empty string
 * and validate at the server (hash + DB lookup).
 */
export const verifyEmailInputSchema = z.object({
  token: z.string().min(1, "Verification token is required").max(1024),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailInputSchema>;

/**
 * Resend the verification email. Server returns the same response whether
 * or not the email exists (anti-enumeration) — caller can't distinguish.
 */
export const resendVerificationInputSchema = z.object({
  email: emailSchema,
});
export type ResendVerificationInput = z.infer<
  typeof resendVerificationInputSchema
>;

// ===========================================================================
// GUEST BOOKING OTP (Step 11A)
// ===========================================================================

/** 6-digit zero-padded numeric code (e.g. "049281"). */
export const otpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Code must be 6 digits");

/**
 * Booking intent — the OTP is bound to this exact intent (tenantSlug from
 * the URL, plus service / staff / startAt from the body). Server computes
 * `intent_hash = sha256(...)` for lookup.
 *
 * `staffId` accepts either a UUID or the literal "any" sentinel — the
 * intent_hash MUST match exactly what the booking endpoint receives, so
 * any picker change between request and confirm requires a fresh OTP.
 */
const bookingIntentSchema = z.object({
  serviceId: uuidSchema,
  staffId: z.union([uuidSchema, z.literal("any")]),
  startAt: z
    .string()
    .datetime({ offset: true, message: "startAt must be ISO 8601 with offset" }),
});

export const guestOtpRequestInputSchema = z
  .object({ email: emailSchema })
  .merge(bookingIntentSchema);
export type GuestOtpRequestInput = z.infer<typeof guestOtpRequestInputSchema>;

export const guestOtpConfirmInputSchema = z
  .object({
    email: emailSchema,
    code: otpCodeSchema,
  })
  .merge(bookingIntentSchema);
export type GuestOtpConfirmInput = z.infer<typeof guestOtpConfirmInputSchema>;

/**
 * Tied to the OTP-confirm response — a successful confirm returns this
 * shape; the client passes `grantToken` back in the booking body's
 * `verificationGrant` field.
 */
export interface GuestOtpConfirmResult {
  grantToken: string;
  expiresAt: string; // ISO
}
