import { describe, expect, it } from 'vitest';
import { confirmationTokenFor, isValidConfirmation } from '../../src/confirmation-token.js';

const SECRET = 'server-secret';

describe('confirmation tokens', () => {
  it('validates a token issued for the exact same action', () => {
    const token = confirmationTokenFor(SECRET, 'close_contest', { contestId: 'c1' });
    expect(isValidConfirmation(SECRET, 'close_contest', { contestId: 'c1' }, token)).toBe(true);
  });

  it('is action-bound: a token for one contest does not validate another', () => {
    const token = confirmationTokenFor(SECRET, 'close_contest', { contestId: 'c1' });
    expect(isValidConfirmation(SECRET, 'close_contest', { contestId: 'c2' }, token)).toBe(false);
  });

  it('is action-bound: a token for one tool does not validate another', () => {
    const token = confirmationTokenFor(SECRET, 'close_contest', { contestId: 'c1' });
    expect(isValidConfirmation(SECRET, 'trigger_reveal', { contestId: 'c1' }, token)).toBe(false);
  });

  it('ignores the confirmationToken field itself when deriving the token', () => {
    // The token minted on the unconfirmed call must equal the one validated on the confirmed call.
    const minted = confirmationTokenFor(SECRET, 'close_contest', { contestId: 'c1' });
    expect(isValidConfirmation(SECRET, 'close_contest', { contestId: 'c1', confirmationToken: minted }, minted)).toBe(true);
  });

  it('cannot be forged without the secret', () => {
    const token = confirmationTokenFor(SECRET, 'close_contest', { contestId: 'c1' });
    expect(isValidConfirmation('wrong-secret', 'close_contest', { contestId: 'c1' }, token)).toBe(false);
  });

  it('rejects a missing or non-string token', () => {
    expect(isValidConfirmation(SECRET, 'close_contest', { contestId: 'c1' }, undefined)).toBe(false);
    expect(isValidConfirmation(SECRET, 'close_contest', { contestId: 'c1' }, 42)).toBe(false);
  });
});
