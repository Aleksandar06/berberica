import type { Role } from "@prisma/client";

/**
 * Authenticated user attached to the request by JwtStrategy.validate().
 * Designed so Step 5 (tenant resolution) can resolve the active tenant by
 * matching the URL/header to one of the user's memberships.
 */
export interface RequestUser {
  userId: string;
  email: string;
  memberships: ReadonlyArray<{ tenantId: string; role: Role }>;
}

/** Helper: does the user belong to ANY tenant with one of these roles? */
export function userHasAnyRole(
  user: RequestUser,
  roles: ReadonlyArray<Role>,
): boolean {
  if (roles.length === 0) return true;
  for (const m of user.memberships) {
    if (roles.includes(m.role)) return true;
  }
  return false;
}
