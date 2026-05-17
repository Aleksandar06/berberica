import { z } from "zod";

import {
  emailSchema,
  hexColorSchema,
  phoneSchema,
  slotDurationSchema,
  slugSchema,
  timezoneSchema,
} from "./primitives";

// ===========================================================================
// TENANT (SUPER_ADMIN creates; TENANT_ADMIN may update non-slug fields)
// ===========================================================================

// ISO 4217 currency code — 3 uppercase letters. Used to format and
// aggregate service prices and earnings reports across the tenant.
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO 4217 code (EUR, MKD, USD…)");

export const tenantCreateInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  slug: slugSchema,
  businessType: z.string().trim().min(1, "Business type is required").max(64),
  timezone: timezoneSchema,
  currency: currencyCodeSchema.optional(),
  contactEmail: emailSchema.optional(),
  contactPhone: phoneSchema.optional(),
  address: z.string().trim().max(500).optional(),
});
export type TenantCreateInput = z.infer<typeof tenantCreateInputSchema>;

// Slug intentionally omitted — changing slugs would break public URLs and is
// handled by a separate SUPER_ADMIN flow (later step). All other fields
// nullable so admins can clear an optional value.
export const tenantUpdateInputSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  businessType: z.string().trim().min(1).max(64).optional(),
  timezone: timezoneSchema.optional(),
  currency: currencyCodeSchema.optional(),
  contactEmail: emailSchema.nullable().optional(),
  contactPhone: phoneSchema.nullable().optional(),
  address: z.string().trim().max(500).nullable().optional(),
});
export type TenantUpdateInput = z.infer<typeof tenantUpdateInputSchema>;

// ===========================================================================
// TENANT SETTINGS
// ===========================================================================

// 30 days expressed in minutes — generous upper bound on cutoffs / lead time
// to catch typos (e.g. someone entering minutes instead of hours).
const MAX_MINUTES = 60 * 24 * 30;

export const tenantSettingsUpdateInputSchema = z
  .object({
    defaultSlotDurationMinutes: slotDurationSchema.optional(),
    bookingLeadTimeMinutes: z
      .number()
      .int()
      .min(0, "Lead time cannot be negative")
      .max(MAX_MINUTES)
      .optional(),
    bookingMaxDaysAhead: z
      .number()
      .int()
      .min(1, "Must allow at least one day ahead")
      .max(365)
      .optional(),
    allowGuestBooking: z.boolean().optional(),
    allowCustomerCancellation: z.boolean().optional(),
    cancellationCutoffMinutes: z
      .number()
      .int()
      .min(0, "Cancellation cutoff cannot be negative")
      .max(MAX_MINUTES)
      .optional(),
    allowCustomerReschedule: z.boolean().optional(),
    rescheduleCutoffMinutes: z
      .number()
      .int()
      .min(0, "Reschedule cutoff cannot be negative")
      .max(MAX_MINUTES)
      .optional(),
    cancellationPolicy: z.string().trim().max(5000).nullable().optional(),
    reschedulePolicy: z.string().trim().max(5000).nullable().optional(),
    // Step 11A — when true, authenticated users with `emailVerified=false`
    // cannot finalize a booking at this tenant. Default false (UX-friendly).
    requireVerifiedAccountForBooking: z.boolean().optional(),
  })
  .strict();
export type TenantSettingsUpdateInput = z.infer<
  typeof tenantSettingsUpdateInputSchema
>;

// ===========================================================================
// TENANT BRANDING
// ===========================================================================

export const ALLOWED_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
export type AllowedLogoMimeType = (typeof ALLOWED_LOGO_MIME_TYPES)[number];

export const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

/**
 * Cap for the persisted `logoUrl` string. Plain http(s) URLs are tiny;
 * inline `data:image/...` URLs (browser-uploaded logos base64-encoded into
 * the column) inflate ~33% over the raw byte size. 4 MB ceiling gives a
 * generous safety margin over a 2 MB raw image while keeping postgres
 * happy with the value living in a single text column.
 */
const MAX_LOGO_URL_CHARS = 4 * 1024 * 1024;

/**
 * Accepts either:
 *   • an http(s) URL — for externally hosted logos
 *   • a `data:image/<png|jpeg|webp|svg+xml>;base64,...` URL — for the
 *     browser-upload-to-DB flow (no external storage required for hackathon
 *     scale; can migrate to S3 later without changing this contract)
 *
 * `null` clears the logo; `undefined` leaves it untouched in PATCH.
 */
const DATA_URL_RE =
  /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const HTTP_URL_RE = /^https?:\/\/[^\s]+$/i;

const logoUrlSchema = z
  .string()
  .max(MAX_LOGO_URL_CHARS)
  .refine(
    (val) => DATA_URL_RE.test(val) || HTTP_URL_RE.test(val),
    {
      message:
        "Must be an http(s) URL or a data:image base64 URI (PNG, JPEG, WEBP, SVG)",
    },
  )
  .nullable()
  .optional();

export const tenantBrandingUpdateInputSchema = z.object({
  logoUrl: logoUrlSchema,
  primaryColor: hexColorSchema.nullable().optional(),
  secondaryColor: hexColorSchema.nullable().optional(),
  accentColor: hexColorSchema.nullable().optional(),
});
export type TenantBrandingUpdateInput = z.infer<
  typeof tenantBrandingUpdateInputSchema
>;

/**
 * Validates a logo file's reported metadata before the upload is accepted.
 * (Server still verifies the actual bytes against this — clients lie.)
 */
export const tenantLogoUploadMetadataSchema = z.object({
  mimeType: z.enum(ALLOWED_LOGO_MIME_TYPES, {
    errorMap: () => ({
      message: `Logo must be one of: ${ALLOWED_LOGO_MIME_TYPES.join(", ")}`,
    }),
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_LOGO_BYTES, `Logo must be ≤ ${MAX_LOGO_BYTES / 1024 / 1024} MB`),
});
export type TenantLogoUploadMetadata = z.infer<
  typeof tenantLogoUploadMetadataSchema
>;
