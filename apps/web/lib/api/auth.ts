import { API_BASE_URL, ApiError } from "./client";
import { authedFetch } from "./authed-client";

// =============================================================================
// TYPES (mirror API responses)
// =============================================================================

export interface SessionUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailVerified: boolean;
}

export interface Membership {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: "SUPER_ADMIN" | "TENANT_ADMIN" | "STAFF" | "CUSTOMER";
}

export interface MeResponse {
  user: SessionUser;
  memberships: Membership[];
}

export interface LoginResponse {
  user: SessionUser;
  accessToken: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// =============================================================================
// CALLS
// =============================================================================

/**
 * Login — uses bare fetch (not authedFetch) because we don't yet have a
 * token and the response IS the new token. credentials: 'include' so the
 * Set-Cookie for refresh_token gets stored by the browser.
 */
export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      parsed?.error?.code ?? "UNAUTHORIZED",
      parsed?.error?.message ?? "Login failed",
    );
  }
  return parsed as LoginResponse;
}

export async function register(input: RegisterInput): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  const parsed = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(
      res.status,
      parsed?.error?.code ?? "REGISTRATION_FAILED",
      parsed?.error?.message ?? "Registration failed",
      parsed?.error?.details,
    );
  }
  return parsed as LoginResponse;
}

export function me(): Promise<MeResponse> {
  return authedFetch<MeResponse>("/api/auth/me");
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function resendVerification(email: string): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/resend-verification`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}
