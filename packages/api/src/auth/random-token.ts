import { createHash, randomBytes } from 'node:crypto';

/**
 * A high-entropy random bearer secret — a personal access token, an invitation
 * link's token. Unlike a password it is not chosen by a person, so it needs no
 * slow hash to resist guessing: its entropy is the defense.
 */
export function generateSecretToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 of a raw secret, for O(1) lookup by hash. Fast is fine — the token itself is the secret. */
export function hashSecretToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('base64url');
}
