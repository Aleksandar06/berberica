import type { Membership } from "../api/auth";

/**
 * Decides which dashboard a user lands on right after login. Priority is
 * deliberate: SUPER_ADMIN trumps any tenant role, which trumps the
 * customer-only path. Users with NO memberships are still customers (they
 * just have no bookings yet).
 */
export function dashboardForMemberships(memberships: Membership[]): string {
  if (memberships.some((m) => m.role === "SUPER_ADMIN")) {
    return "/dashboard/admin";
  }
  if (
    memberships.some((m) => m.role === "TENANT_ADMIN" || m.role === "STAFF")
  ) {
    return "/dashboard/business";
  }
  return "/dashboard/customer";
}

export function hasRole(
  memberships: Membership[],
  roles: Array<Membership["role"]>,
): boolean {
  return memberships.some((m) => roles.includes(m.role));
}
