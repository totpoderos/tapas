import { invitationHasExpired } from '@tapas/domain';
import type { StoredInvitation } from '../../db/host-invitation-repository.js';

/**
 * The one answer for a link that cannot be used, whatever the reason — unknown,
 * already accepted, or out of time. Naming no address and drawing no
 * distinction is what stops a link becoming an oracle for who was invited
 * (OWASP A07). The security log is where the distinction survives.
 */
export const INVITATION_UNUSABLE = {
  code: 'INVITATION_UNUSABLE',
  message: 'That link cannot be used.',
} as const;

/** Why a link did not work. Never shown to the caller; recorded for an auditor. */
export type UnusableReason = 'unknown' | 'already_accepted' | 'expired';

export type Usability =
  | { readonly usable: true; readonly invitation: StoredInvitation }
  | { readonly usable: false; readonly reason: UnusableReason };

/**
 * The single place that decides whether an invitation can be used. Both the
 * route that opens a link and the one that accepts it ask this and nothing
 * else.
 *
 * That is deliberate. Each used to test `status` for itself, and a second
 * condition added to both independently is exactly how two paths meant to agree
 * end up disagreeing. Leaving one place for a third condition to go is the
 * point.
 */
export function usabilityOf(
  invitation: StoredInvitation | undefined,
  nowIso: string,
): Usability {
  if (!invitation) return { usable: false, reason: 'unknown' };
  if (invitation.status !== 'pending') return { usable: false, reason: 'already_accepted' };
  if (invitationHasExpired(invitation.issuedAt, nowIso))
    return { usable: false, reason: 'expired' };
  return { usable: true, invitation };
}
