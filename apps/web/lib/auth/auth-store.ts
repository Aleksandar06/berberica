/**
 * Module-scoped mutable store for the in-memory access token + a callback
 * the authed-client invokes when the session is gone (so the AuthProvider
 * can route to /login). Keeping it OUTSIDE React lets `authedFetch`
 * (called from anywhere — TanStack Query, route handlers) read the latest
 * token without needing a hook.
 *
 * The token lives ONLY in memory — losing it on page refresh is by design;
 * the HttpOnly refresh cookie (set by the API) is what restores the session
 * via /api/auth/refresh on the next request.
 */

type UnauthorizedCallback = () => void;

let _accessToken: string | null = null;
let _tenantSlug: string | null = null;
let _onUnauthorized: UnauthorizedCallback | null = null;

export const authStore = {
  setAccessToken(token: string | null): void {
    _accessToken = token;
  },
  getAccessToken(): string | null {
    return _accessToken;
  },
  /**
   * The active tenant slug for /api/business/* multi-membership users.
   * Single-membership users leave this null and the API picks the only
   * qualifying membership automatically.
   */
  setTenantSlug(slug: string | null): void {
    _tenantSlug = slug;
  },
  getTenantSlug(): string | null {
    return _tenantSlug;
  },
  setOnUnauthorized(cb: UnauthorizedCallback | null): void {
    _onUnauthorized = cb;
  },
  notifyUnauthorized(): void {
    _onUnauthorized?.();
  },
};
