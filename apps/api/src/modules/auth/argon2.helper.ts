import { hash, verify, Algorithm } from "@node-rs/argon2";

/**
 * Argon2id parameters.
 *
 * Tuned for the OWASP Password Storage Cheat Sheet recommendation for
 * Argon2id (2024):
 *   • memory ≥ 19 MiB
 *   • iterations ≥ 2
 *   • parallelism = 1
 *
 * Why @node-rs/argon2 over the `argon2` npm package:
 *   • Prebuilt Rust binaries — no node-gyp on Windows.
 *   • ~10× faster verify, identical hash format (argon2 PHC string),
 *     so hashes are interoperable with other Argon2id verifiers.
 */
const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456, // KiB → ~19 MB
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hash a plaintext password. Returns the PHC-formatted hash string. */
export function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verify plaintext against a stored hash.
 * Returns false (never throws) on garbage hashes so the caller can issue
 * a uniform "invalid credentials" response without leaking detail.
 */
export async function verifyPassword(
  storedHash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, plaintext);
  } catch {
    return false;
  }
}
