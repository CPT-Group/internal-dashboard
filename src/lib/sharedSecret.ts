import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time comparison of a caller-supplied secret against the expected server value.
 * Both sides are hashed first so the comparison runs on equal-length buffers and does not
 * leak the expected secret's length. Server-side only (node runtime).
 */
export function sharedSecretMatches(provided: string | null, expected: string): boolean {
  if (provided === null || provided.length === 0 || expected.length === 0) return false;
  const providedDigest = createHash('sha256').update(provided, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}
