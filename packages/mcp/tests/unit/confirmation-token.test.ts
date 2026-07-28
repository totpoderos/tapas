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

  // Deleting is the only action with no undo, so the binding matters most here:
  // an approval authorises one deletion of one contest and nothing else.
  it('binds a delete approval to the one contest it was issued for', () => {
    const token = confirmationTokenFor(SECRET, 'delete_contest', { contestId: 'c1' });
    expect(isValidConfirmation(SECRET, 'delete_contest', { contestId: 'c1' }, token)).toBe(true);
    expect(isValidConfirmation(SECRET, 'delete_contest', { contestId: 'c2' }, token)).toBe(false);
  });

  it('binds a delete approval to the name it was approved with', () => {
    const token = confirmationTokenFor(SECRET, 'delete_contest', {
      contestId: 'c1',
      confirmName: 'Summer Tapas',
    });
    // Approving "delete Summer Tapas" does not approve deleting it unnamed, nor
    // under a different name — the token covers every argument.
    expect(isValidConfirmation(SECRET, 'delete_contest', { contestId: 'c1' }, token)).toBe(false);
    expect(
      isValidConfirmation(
        SECRET,
        'delete_contest',
        { contestId: 'c1', confirmName: 'Winter Tapas' },
        token,
      ),
    ).toBe(false);
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
