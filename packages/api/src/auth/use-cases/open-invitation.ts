import type { Clock } from '../../audit/audit-projection.js';
import type { HostInvitationRepository } from '../../db/host-invitation-repository.js';
import { hashSecretToken } from '../random-token.js';
import { INVITATION_UNUSABLE, usabilityOf, type UnusableReason } from './invitation-shared.js';

export type OpenInvitationResult =
  | { readonly ok: true; readonly email: string }
  | {
      readonly ok: false;
      readonly error: typeof INVITATION_UNUSABLE;
      readonly reason: UnusableReason;
    };

export interface OpenInvitationDeps {
  readonly invitations: HostInvitationRepository;
  readonly clock: Clock;
}

/**
 * Reports whether an invitation link is still good, and whom it is for.
 *
 * A pure read, deliberately: mail-security products fetch every link in a
 * message before delivering it, so an invitation consumed on open would be dead
 * before its recipient ever clicked. Only choosing a password spends it — and
 * opening an expired link does not un-expire it either.
 */
export class OpenInvitation {
  constructor(private readonly deps: OpenInvitationDeps) {}

  execute(rawToken: string): OpenInvitationResult {
    const found = this.deps.invitations.findByTokenHash(hashSecretToken(rawToken));
    const usability = usabilityOf(found, this.deps.clock.now());
    if (!usability.usable)
      return { ok: false, error: INVITATION_UNUSABLE, reason: usability.reason };
    return { ok: true, email: usability.invitation.email };
  }
}
