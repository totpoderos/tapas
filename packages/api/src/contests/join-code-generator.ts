import { randomBytes } from 'node:crypto';

/** Issues join codes. Injected so tests can use deterministic codes. */
export interface JoinCodeGenerator {
  next(): string;
}

/** High-entropy, non-sequential, uppercase alphanumeric codes. */
export class RandomJoinCodeGenerator implements JoinCodeGenerator {
  next(): string {
    return randomBytes(6).toString('base64url').replace(/[-_]/g, '').slice(0, 8).toUpperCase();
  }
}
