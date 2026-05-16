import { z } from "zod";

// Caps: services rarely exceed 8 hours; buffers rarely exceed 4 hours.
// Generous bounds that still catch unit-confusion typos (e.g. hours-as-minutes).
const MAX_SERVICE_MINUTES = 8 * 60;
const MAX_BUFFER_MINUTES = 4 * 60;

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
  isActive: z.boolean().default(true),
});
export type ServiceCreateInput = z.infer<typeof serviceCreateInputSchema>;

export const serviceUpdateInputSchema = serviceCreateInputSchema.partial();
export type ServiceUpdateInput = z.infer<typeof serviceUpdateInputSchema>;
