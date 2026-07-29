import { describe, expect, it } from 'vitest';
import { mergePeople } from '../../src/people/merge-people';

const JULY = (day: number) => `2026-07-0${day}T10:00:00.000Z`;

/**
 * The one piece of real logic in the panel, tested before any of it renders.
 * The rule reads simply and is easy to get subtly wrong: an account beats any
 * invitation to the same address, and where there is no account the newest
 * invitation stands for the person.
 */
describe('mergePeople', () => {
  it('shows an account and its accepted invitation as one person', () => {
    // After invitations became the way in, most accounts have one behind them.
    // Without this rule the list doubles.
    const merged = mergePeople(
      [{ email: 'bob@example.com', isAdministrator: false }],
      [{ id: 'i1', email: 'bob@example.com', status: 'accepted', issuedAt: JULY(1) }],
    );

    expect(merged).toEqual([{ email: 'bob@example.com', standing: 'host' }]);
  });

  it('shows an administrator as one', () => {
    const merged = mergePeople([{ email: 'ana@example.com', isAdministrator: true }], []);

    expect(merged).toEqual([{ email: 'ana@example.com', standing: 'administrator' }]);
  });

  it('stands the newest invitation for an address with no account', () => {
    const merged = mergePeople(
      [],
      [
        { id: 'i1', email: 'nuevo@example.com', status: 'superseded', issuedAt: JULY(1) },
        { id: 'i2', email: 'nuevo@example.com', status: 'pending', issuedAt: JULY(2) },
      ],
    );

    // The superseded one is simply no longer the newest — nothing had to follow
    // a chain to hide it.
    expect(merged).toEqual([
      { email: 'nuevo@example.com', standing: 'pending', invitationId: 'i2' },
    ]);
  });

  it('is not fooled by the newest arriving first', () => {
    const merged = mergePeople(
      [],
      [
        { id: 'i2', email: 'nuevo@example.com', status: 'pending', issuedAt: JULY(2) },
        { id: 'i1', email: 'nuevo@example.com', status: 'superseded', issuedAt: JULY(1) },
      ],
    );

    expect(merged[0]!.invitationId).toBe('i2');
  });

  it('never gives one person two rows', () => {
    const merged = mergePeople(
      [{ email: 'bob@example.com', isAdministrator: false }],
      [
        { id: 'i1', email: 'bob@example.com', status: 'accepted', issuedAt: JULY(1) },
        { id: 'i2', email: 'bob@example.com', status: 'revoked', issuedAt: JULY(2) },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]!.standing).toBe('host');
  });

  it('keeps an expired or revoked invitation visible when there is no account', () => {
    const merged = mergePeople(
      [],
      [
        { id: 'i1', email: 'gone@example.com', status: 'revoked', issuedAt: JULY(1) },
        { id: 'i2', email: 'late@example.com', status: 'expired', issuedAt: JULY(1) },
      ],
    );

    expect(merged.map((person) => person.standing)).toEqual(['revoked', 'expired']);
  });

  it('lists people in a stable order, whatever order they arrived in', () => {
    const merged = mergePeople(
      [{ email: 'zoe@example.com', isAdministrator: false }],
      [{ id: 'i1', email: 'ana@example.com', status: 'pending', issuedAt: JULY(1) }],
    );

    expect(merged.map((person) => person.email)).toEqual([
      'ana@example.com',
      'zoe@example.com',
    ]);
  });

  it('has nobody to show when nobody exists', () => {
    expect(mergePeople([], [])).toEqual([]);
  });
});
