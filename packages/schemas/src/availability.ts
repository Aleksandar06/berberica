import { z } from "zod";

import {
  dayOfWeekSchema,
  isoDateIsTodayOrFuture,
  isoDateSchema,
  slotDurationSchema,
  timeStringIsBefore,
  timeStringSchema,
  uuidSchema,
} from "./primitives";

// ===========================================================================
// AVAILABILITY RULES (weekly recurring working hours)
// ===========================================================================

export const availabilityRuleCreateInputSchema = z
  .object({
    // null/omitted = tenant-wide rule (applies to every staff member).
    staffMemberId: uuidSchema.nullable().optional(),
    dayOfWeek: dayOfWeekSchema,
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    // null/omitted = use tenant's defaultSlotDurationMinutes.
    slotDurationMinutes: slotDurationSchema.nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .refine((d) => timeStringIsBefore(d.startTime, d.endTime), {
    message: "startTime must be before endTime",
    path: ["endTime"],
  });
export type AvailabilityRuleCreateInput = z.infer<
  typeof availabilityRuleCreateInputSchema
>;

/**
 * Update keeps every field optional, but the start<end cross-check still fires
 * whenever BOTH startTime and endTime are present in the payload.
 */
export const availabilityRuleUpdateInputSchema = z
  .object({
    staffMemberId: uuidSchema.nullable().optional(),
    dayOfWeek: dayOfWeekSchema.optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    slotDurationMinutes: slotDurationSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.startTime === undefined ||
      d.endTime === undefined ||
      timeStringIsBefore(d.startTime, d.endTime),
    { message: "startTime must be before endTime", path: ["endTime"] },
  );
export type AvailabilityRuleUpdateInput = z.infer<
  typeof availabilityRuleUpdateInputSchema
>;

// ===========================================================================
// AVAILABILITY BREAKS (recurring weekly breaks inside working hours)
// ===========================================================================

export const availabilityBreakCreateInputSchema = z
  .object({
    staffMemberId: uuidSchema.nullable().optional(),
    dayOfWeek: dayOfWeekSchema,
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    isActive: z.boolean().default(true),
  })
  .refine((d) => timeStringIsBefore(d.startTime, d.endTime), {
    message: "startTime must be before endTime",
    path: ["endTime"],
  });
export type AvailabilityBreakCreateInput = z.infer<
  typeof availabilityBreakCreateInputSchema
>;

export const availabilityBreakUpdateInputSchema = z
  .object({
    staffMemberId: uuidSchema.nullable().optional(),
    dayOfWeek: dayOfWeekSchema.optional(),
    startTime: timeStringSchema.optional(),
    endTime: timeStringSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (d) =>
      d.startTime === undefined ||
      d.endTime === undefined ||
      timeStringIsBefore(d.startTime, d.endTime),
    { message: "startTime must be before endTime", path: ["endTime"] },
  );
export type AvailabilityBreakUpdateInput = z.infer<
  typeof availabilityBreakUpdateInputSchema
>;

// ===========================================================================
// AVAILABILITY EXCEPTIONS (date-specific overrides or closures)
// ===========================================================================

/**
 * Cross-field rules:
 *   • If `isClosed` is true → both custom hours MUST be absent.
 *   • If `isClosed` is false → custom hours are optional, but if either is
 *     present then BOTH must be present and `customStartTime < customEndTime`.
 *   • `exceptionDate` cannot be in the past (UTC reference; tenant-TZ rules
 *     for the lead-time policy are enforced server-side).
 */
export const availabilityExceptionCreateInputSchema = z
  .object({
    staffMemberId: uuidSchema.nullable().optional(),
    exceptionDate: isoDateSchema.refine(
      isoDateIsTodayOrFuture,
      "exceptionDate cannot be in the past",
    ),
    isClosed: z.boolean(),
    customStartTime: timeStringSchema.nullable().optional(),
    customEndTime: timeStringSchema.nullable().optional(),
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((d, ctx) => {
    const hasStart = d.customStartTime != null;
    const hasEnd = d.customEndTime != null;
    if (d.isClosed) {
      if (hasStart || hasEnd) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Closed exceptions cannot have custom hours",
          path: ["customStartTime"],
        });
      }
      return;
    }
    if (hasStart !== hasEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customStartTime and customEndTime must both be provided",
        path: [hasStart ? "customEndTime" : "customStartTime"],
      });
      return;
    }
    if (hasStart && hasEnd && !timeStringIsBefore(d.customStartTime!, d.customEndTime!)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "customStartTime must be before customEndTime",
        path: ["customEndTime"],
      });
    }
  });
export type AvailabilityExceptionCreateInput = z.infer<
  typeof availabilityExceptionCreateInputSchema
>;

export const availabilityExceptionBreakCreateInputSchema = z
  .object({
    staffMemberId: uuidSchema.nullable().optional(),
    exceptionDate: isoDateSchema,
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    reason: z.string().trim().max(500).nullable().optional(),
  })
  .refine((d) => timeStringIsBefore(d.startTime, d.endTime), {
    message: "startTime must be before endTime",
    path: ["endTime"],
  });
export type AvailabilityExceptionBreakCreateInput = z.infer<
  typeof availabilityExceptionBreakCreateInputSchema
>;

// =============================================================================
// CAPACITY PREVIEW (Step 10) — admin-only schedule analysis query.
// =============================================================================
//
// `mode`:
//   • "theoretical" — what could fit if the day were empty. Ignores existing
//     bookings; useful for "is my slot/service duration combo sensible?".
//   • "real_day"   — what could STILL fit today. Subtracts active bookings.
// =============================================================================

export const capacityPreviewQuerySchema = z.object({
  staffMemberId: uuidSchema,
  serviceId: uuidSchema,
  date: isoDateSchema,
  mode: z.enum(["theoretical", "real_day"]).default("theoretical"),
});
export type CapacityPreviewQuery = z.infer<typeof capacityPreviewQuerySchema>;
