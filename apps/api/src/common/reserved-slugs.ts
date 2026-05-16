/**
 * Slugs reserved for platform-level routes; cannot be used as tenant slugs.
 *
 * Enforced at two layers (defense in depth):
 *   1. Database — CHECK constraint `tenants_slug_reserved_chk` in the init
 *      migration. Final guarantee even if app validation is bypassed.
 *   2. Application — this constant, consumed by the shared Zod schemas in
 *      `packages/schemas` (Step 3) and any tenant-creation guards.
 *
 * If you add or remove an entry, also update the CHECK constraint in
 * `prisma/migrations/<init>/migration.sql`.
 */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "dashboard",
  "login",
  "register",
  "pricing",
  "support",
  "terms",
  "privacy",
  "settings",
  "account",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}
