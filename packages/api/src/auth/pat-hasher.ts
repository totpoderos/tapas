import { generateSecretToken, hashSecretToken } from './random-token.js';

/** A high-entropy random bearer token — unlike a password, no slow hash is needed to resist guessing. */
export function generatePatToken(): string {
  return generateSecretToken();
}

/** SHA-256 of a raw PAT, for O(1) lookup by hash — fast is fine here; the token itself is the secret. */
export function hashPatToken(rawToken: string): string {
  return hashSecretToken(rawToken);
}
