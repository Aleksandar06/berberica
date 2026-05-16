/**
 * Authenticated API client for dashboard routes.
 *
 *   • Sends `Authorization: Bearer <token>` from authStore on every call.
 *   • Sends `X-Tenant-Slug` when a tenant is selected (Step 5 — required for
 *     business multi-membership users; harmless for everyone else).
 *   • Sends `credentials: 'include'` so the HttpOnly refresh cookie rides
 *     along on /auth/refresh.
 *   • On 401 → tries /auth/refresh once → if refresh succeeds, retries the
 *     original call. If refresh fails → notifies authStore (AuthProvider
 *     routes to /login) and throws an ApiError.
 *
 * Public storefront code keeps using `apiFetch` from `lib/api/client.ts`
 * (unauthenticated, no refresh) — the two clients are intentionally
 * separate so private auth state can never accidentally leak into a public
 * page.
 */

import { API_BASE_URL, ApiError } from "./client";
import type { ApiErrorBody } from "./types";
import { authStore } from "../auth/auth-store";

interface AuthedFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Refresh promise singleton — concurrent 401s share one /refresh call so
 * we don't burn rotation tokens.
 */
let refreshInFlight: Promise<string | null> | null = null;

async function refreshOnce(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          // Step 4 CSRF defense — browsers can't add this to cross-site form posts.
          "X-Requested-With": "XMLHttpRequest",
        },
        body: "{}",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken: string };
      authStore.setAccessToken(data.accessToken);
      return data.accessToken;
    } catch {
      return null;
    } finally {
      // Allow the next stale-401 to attempt its own refresh.
      setTimeout(() => {
        refreshInFlight = null;
      }, 50);
    }
  })();
  return refreshInFlight;
}

async function doFetch(
  url: string,
  options: AuthedFetchOptions,
  token: string | null,
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const tenantSlug = authStore.getTenantSlug();
  if (tenantSlug && !headers.has("X-Tenant-Slug")) {
    headers.set("X-Tenant-Slug", tenantSlug);
  }
  return fetch(url, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: "include",
  });
}

export async function authedFetch<T>(
  path: string,
  options: AuthedFetchOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  let res = await doFetch(url, options, authStore.getAccessToken());
  if (res.status === 401) {
    const newToken = await refreshOnce();
    if (!newToken) {
      authStore.notifyUnauthorized();
      throw new ApiError(401, "UNAUTHORIZED", "Session expired");
    }
    res = await doFetch(url, options, newToken);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ApiError(res.status, "INVALID_RESPONSE", text.slice(0, 200));
    }
  }
  if (!res.ok) {
    const body = parsed as ApiErrorBody | null;
    throw new ApiError(
      res.status,
      body?.error?.code ?? "UNKNOWN",
      body?.error?.message ?? `Request failed with status ${res.status}`,
      body?.error?.details,
    );
  }
  return parsed as T;
}
