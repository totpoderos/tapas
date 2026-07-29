export interface HostAccountRow {
  readonly email: string;
  readonly isAdministrator: boolean;
}

export interface InvitationRow {
  readonly id: string;
  readonly email: string;
  readonly status: string;
  readonly issuedAt: string;
}

export type Standing = 'administrator' | 'host' | 'pending' | 'expired' | 'revoked' | 'superseded';

export interface Person {
  readonly email: string;
  readonly standing: Standing;
  /** Present only when this person is an invitation — what revoke and resend act on. */
  readonly invitationId?: string;
}

/**
 * One row per person, from the two lists the API keeps separately.
 *
 * An account beats any invitation to the same address, because after
 * invitations became the way in most accounts have an accepted one behind them
 * and the list would otherwise double. Where there is no account, the newest
 * invitation stands for the person — which is what makes a superseded
 * invitation disappear when it is resent, without anything having to follow
 * `superseded_by`.
 *
 * The question this list answers is whether somebody has access, and that has
 * one answer per person.
 */
export function mergePeople(
  accounts: readonly HostAccountRow[],
  invitations: readonly InvitationRow[],
): Person[] {
  const people = new Map<string, Person>();

  const newestPerAddress = new Map<string, InvitationRow>();
  for (const invitation of invitations) {
    const seen = newestPerAddress.get(invitation.email);
    if (!seen || Date.parse(invitation.issuedAt) > Date.parse(seen.issuedAt))
      newestPerAddress.set(invitation.email, invitation);
  }
  for (const [email, invitation] of newestPerAddress)
    people.set(email, {
      email,
      standing: invitation.status as Standing,
      invitationId: invitation.id,
    });

  // Set last, so an account overwrites whatever invitation stood for it.
  for (const account of accounts)
    people.set(account.email, {
      email: account.email,
      standing: account.isAdministrator ? 'administrator' : 'host',
    });

  return [...people.values()].sort((one, other) => one.email.localeCompare(other.email));
}
