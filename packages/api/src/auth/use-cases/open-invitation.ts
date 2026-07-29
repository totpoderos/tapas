import type { HostInvitationRepository } from '../../db/host-invitation-repository.js';
import { hashSecretToken } from '../random-token.js';
import { INVITATION_UNUSABLE } from './invitation-shared.js';

export type OpenInvitationResult =
  | { readonly ok: true; readonly email: string }
  | { readonly ok: false; readonly error: typeof INVITATION_UNUSABLE };

export interface OpenInvitationDeps {
  readonly invitations: HostInvitationRepository;
}

/**
 * Reports whether an invitation link is still good, and whom it is for.
 *
 * A pure read, deliberately: mail-security products fetch every link in a
 * message before delivering it, so an invitation consumed on open would be dead
 * before its recipient ever clicked. Only choosing a password spends it.
 */
export class OpenInvitation {
  constructor(private readonly deps: OpenInvitationDeps) {}

  execute(rawToken: string): OpenInvitationResult {
    const invitation = this.deps.invitations.findByTokenHash(hashSecretToken(rawToken));
    if (!invitation || invitation.status !== 'pending')
      return { ok: false, error: INVITATION_UNUSABLE };
    return { ok: true, email: invitation.email };
  }
}
