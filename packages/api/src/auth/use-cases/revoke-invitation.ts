import type { Clock } from '../../audit/audit-projection.js';
import type { HostInvitationRepository } from '../../db/host-invitation-repository.js';
import { usabilityOf } from './invitation-shared.js';

export type RevokeInvitationErrorCode = 'INVITATION_NOT_FOUND' | 'NOTHING_TO_REVOKE';

export type RevokeInvitationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly error: { readonly code: RevokeInvitationErrorCode; readonly message: string };
    };

export interface RevokeInvitationDeps {
  readonly invitations: HostInvitationRepository;
  readonly clock: Clock;
}

/**
 * Kills a live invitation's link. Named by id — no administrative route takes a
 * token, because an administrator who could read a link could accept an
 * invitation on someone else's behalf, and revoking needs no such power.
 *
 * Refused for anything not currently usable, expired included. Revoking exists
 * to make a live link dead; an expired one is already dead, and saying so is
 * more honest than writing a status that changes nothing.
 */
export class RevokeInvitation {
  constructor(private readonly deps: RevokeInvitationDeps) {}

  execute(id: string): RevokeInvitationResult {
    const invitation = this.deps.invitations.findById(id);
    if (!invitation)
      return {
        ok: false,
        error: { code: 'INVITATION_NOT_FOUND', message: 'No such invitation.' },
      };

    if (!usabilityOf(invitation, this.deps.clock.now()).usable)
      return {
        ok: false,
        error: { code: 'NOTHING_TO_REVOKE', message: 'That invitation is not live.' },
      };

    this.deps.invitations.markRevoked(id, this.deps.clock.now());
    return { ok: true };
  }
}
