import { z } from "zod";

import { uuidSchema } from "./primitives";

export const staffMemberCreateInputSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(120),
  userId: uuidSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});
export type StaffMemberCreateInput = z.infer<
  typeof staffMemberCreateInputSchema
>;

export const staffMemberUpdateInputSchema =
  staffMemberCreateInputSchema.partial();
export type StaffMemberUpdateInput = z.infer<
  typeof staffMemberUpdateInputSchema
>;

export const staffServiceAssignmentInputSchema = z.object({
  staffMemberId: uuidSchema,
  serviceId: uuidSchema,
});
export type StaffServiceAssignmentInput = z.infer<
  typeof staffServiceAssignmentInputSchema
>;

/**
 * Bulk replace the full set of services a staff member can perform.
 * Server enforces:
 *   • Every serviceId belongs to the resolved tenant (Step 5 ownership helper)
 *   • Duplicates are deduped server-side before insert
 *   • The replace is transactional (delete-all + create-many)
 *
 * Upper bound 500 is generous — a single staff member rarely performs more
 * than a dozen services; the cap is a footgun guard against accidental
 * "give them every service" requests.
 */
export const staffServicesReplaceInputSchema = z.object({
  serviceIds: z.array(uuidSchema).max(500),
});
export type StaffServicesReplaceInput = z.infer<
  typeof staffServicesReplaceInputSchema
>;
