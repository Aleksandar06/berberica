import { z } from "zod";

import { emailSchema } from "./primitives";
import { tenantCreateInputSchema } from "./tenant";

// ===========================================================================
// SUPER_ADMIN — tenant lifecycle
// ===========================================================================

/**
 * Super admin creates a tenant + the initial TENANT_ADMIN user atomically.
 * The admin's password is GENERATED server-side and returned ONCE in the
 * response (never stored anywhere except the user's password hash) — see
 * AdminTenantsService.create for the security trade-off rationale.
 */
export const adminCreateTenantInputSchema = tenantCreateInputSchema.extend({
  adminEmail: emailSchema,
  adminFirstName: z.string().trim().min(1).max(80).optional(),
  adminLastName: z.string().trim().min(1).max(80).optional(),
});
export type AdminCreateTenantInput = z.infer<
  typeof adminCreateTenantInputSchema
>;

/** Paginated list query. Status filter optional; search matches name OR slug. */
export const adminListTenantsQuerySchema = z.object({
  status: z.enum(["active", "suspended"]).optional(),
  search: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AdminListTenantsQuery = z.infer<
  typeof adminListTenantsQuerySchema
>;

export const tenantSuspendInputSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type TenantSuspendInput = z.infer<typeof tenantSuspendInputSchema>;

export const tenantReactivateInputSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});
export type TenantReactivateInput = z.infer<typeof tenantReactivateInputSchema>;

// ===========================================================================
// SUPER_ADMIN — analytics range query
// ===========================================================================

export const adminAnalyticsRangeQuerySchema = z
  .object({
    from: z
      .string()
      .datetime({ offset: true, message: "from must be ISO 8601 with timezone offset" }),
    to: z
      .string()
      .datetime({ offset: true, message: "to must be ISO 8601 with timezone offset" }),
  })
  .refine(
    (d) => new Date(d.from).getTime() <= new Date(d.to).getTime(),
    { message: "from must be on or before to", path: ["to"] },
  );
export type AdminAnalyticsRangeQuery = z.infer<
  typeof adminAnalyticsRangeQuerySchema
>;
