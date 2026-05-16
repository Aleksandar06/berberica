import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Verification cryptography helpers — kept in one tiny module so all five
 * call sites (account token, OTP, grant, request, confirm) hash with the
 * same primitive.
 *
 * Choice of SHA-256 (no salt, no slow-hash):
 *   • Account tokens are 48 random bytes (384 bits) → cheap to brute-force
 *     a single 256-bit hash space is irrelevant when the preimage space is
 *     already astronomical. SHA-256(token) at rest is safe.
 *   • OTP codes are 6 digits (~20 bits) — vulnerable to offline cracking if
 *     the DB leaks. We rely on:
 *       - 10-minute expiry (limits the leak window)
 *       - per-row attempt counter (locks after 5 wrong tries)
 *       - per-IP throttle (limits online brute force)
 *       - prior-code invalidation on resend (only the latest works)
 *   • Grant tokens are 32 random bytes (256 bits) → same posture as account
 *     tokens. SHA-256 at rest, single-use, 15-min expiry.
 */

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/**
 * Constant-time hash compare. Returns false (never throws) on malformed
 * stored values so the caller can issue a uniform "invalid token" response.
 */
export function compareSecret(candidate: string, storedHashHex: string): boolean {
  try {
    const a = Buffer.from(hashSecret(candidate), "hex");
    const b = Buffer.from(storedHashHex, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Booking-intent hash. Binds an OTP to a specific (tenant, service, staff,
 * startAt) tuple so the code can't be replayed against a different intent.
 * Order-stable + normalized so the same intent always hashes to the same
 * value regardless of caller key order.
 */
export function hashIntent(intent: {
  tenantId: string;
  serviceId: string;
  staffId: string;
  startAt: string;
}): string {
  const parts = [intent.tenantId, intent.serviceId, intent.staffId, intent.startAt];
  return createHash("sha256").update(parts.join("|"), "utf8").digest("hex");
}

// ===========================================================================
// SECRET GENERATORS
// ===========================================================================

/** 48 random bytes base64url-encoded → 64 chars, ~384 bits. */
export function generateAccountToken(): string {
  return randomBytes(48).toString("base64url");
}

/** 32 random bytes base64url-encoded → ~43 chars, 256 bits. */
export function generateGrantToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Cryptographically random 6-digit code. We use `randomInt` (not Math.random)
 * so the distribution is uniform and unbiased — even a low-entropy code
 * deserves a uniform sample of its space.
 */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}
