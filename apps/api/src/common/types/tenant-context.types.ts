import type { TenantStatus } from "@prisma/client";

/**
 * Immutable per-request tenant context attached to `request.tenant` by
 * exactly one of the tenant guards:
 *
 *   • PublicTenantGuard   — resolved from URL slug (/api/public/:tenantSlug/…)
 *   • BusinessTenantGuard — resolved from the authenticated session's
 *                           memberships (/api/business/…)
 *   • AdminTenantGuard    — resolved from path param by SUPER_ADMIN, audited
 *                           (/api/admin/tenants/:tenantId/…)
 *
 * Every record fetched on a tenant-scoped route MUST be filtered by
 * `tenantId === tenant.id`. The TenantOwnershipService is the only sanctioned
 * way to do that — never write ad-hoc `findUnique({ where: { id } })` queries
 * on tenant-owned models.
 */
export interface TenantContext {
  readonly id: string;
  readonly slug: string;
  readonly status: TenantStatus;
  /**
   * Where the context came from. Useful for guard ordering invariants and
   * for the admin-audit hook to flag SUPER_ADMIN-originated reads.
   */
  readonly source: "public" | "business" | "admin";
}

// Augment Fastify's request type so `request.tenant` is typed everywhere.
declare module "fastify" {
  interface FastifyRequest {
    tenant?: TenantContext;
  }
}
