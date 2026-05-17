import { z } from "zod";

// Caps: services rarely exceed 8 hours; buffers rarely exceed 4 hours.
// Generous bounds that still catch unit-confusion typos (e.g. hours-as-minutes).
const MAX_SERVICE_MINUTES = 8 * 60;
const MAX_BUFFER_MINUTES = 4 * 60;
// Price ceiling = 1,000,000 in major currency units (10**8 minor units).
// Catches accidental zero-stacking without constraining real-world venues.
const MAX_PRICE_CENTS = 100_000_000;

export const serviceCreateInputSchema = z.object({
  name: z.string().trim().min(1, "Service name is required").max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  durationMinutes: z
    .number()
    .int()
    .positive("Duration must be positive")
    .max(MAX_SERVICE_MINUTES, "Duration too long"),
  bufferBeforeMinutes: z
    .number()
    .int()
    .min(0, "Buffer cannot be negative")
    .max(MAX_BUFFER_MINUTES)
    .default(0),
  bufferAfterMinutes: z
    .number()
    .int()
    .min(0, "Buffer cannot be negative")
    .max(MAX_BUFFER_MINUTES)
    .default(0),
  // Price in minor currency units (cents). Optional / nullable because
  // some services are "ask for price" (consultations, custom work).
  // Currency lives on the parent Tenant row.
  priceCents: z
    .number()
    .int()
    .min(0, "Price cannot be negative")
    .max(MAX_PRICE_CENTS)
    .nullable()
    .optional(),
  isActive: z.boolean().default(true),
});
export type ServiceCreateInput = z.infer<typeof serviceCreateInputSchema>;

export const serviceUpdateInputSchema = serviceCreateInputSchema.partial();
export type ServiceUpdateInput = z.infer<typeof serviceUpdateInputSchema>;
