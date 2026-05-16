import type { ApiErrorBody } from "./types";

/**
 * Base URL for the API. In dev this points at the NestJS server on :4000;
 * in prod the reverse proxy maps `/api/*` to it on the same origin.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Strongly typed wrapper around `ApiError` so callers can switch on the
 * server-defined error code (e.g. `EMAIL_NOT_VERIFIED`, `SLOT_TAKEN`,
 * `TENANT_SUSPENDED`) without sniffing the response body manually.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /**
   * Server Components only — controls Next.js fetch caching. Default for
   * SSR'd profile is `{ revalidate: 60 }`; client calls leave it untouched.
   */
  next?: { revalidate?: number; tags?: string[] };
}

/**
 * Thin fetch wrapper. Centralizes:
 *   • JSON encoding/decoding.
 *   • Bearer token attachment (left to the caller — we don't read storage here).
 *   • ApiError throwing on non-2xx with the server's structured error body.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const init: RequestInit & { next?: ApiFetchOptions["next"] } = {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };
  if (options.next) {
    init.next = options.next;
  }
  const res = await fetch(url, init);
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
