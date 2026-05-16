import { SetMetadata } from "@nestjs/common";
import { Role } from "@prisma/client";

/** Re-export so consumers import Role from one place. */
export { Role };

export const ROLES_KEY = "roles";

/**
 * Restrict a route to users who have at least one of the listed roles in
 * ANY of their tenant memberships. Tenant-scoped enforcement is added in
 * Step 5 — at that point a guard can additionally require the role be held
 * in the *active* tenant.
 */
export const Roles = (
  ...roles: ReadonlyArray<Role>
): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);
