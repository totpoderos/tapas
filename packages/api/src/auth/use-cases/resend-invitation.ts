import type { HostInvitationRepository } from '../../db/host-invitation-repository.js';
import type { InviteHost } from './invite-host.js';
import { wasEndedByDecision } from './invitation-shared.js';

export type ResendInvitationErrorCode =
  | 'INVITATION_NOT_FOUND'
  | 'INVITATION_FINISHED'
  | 'RESEND_FAILED';

export type ResendInvitationResult =
  | {
      readonly ok: true;
      readonly invitationId: string;
      readonly messageSent: boolean;
      readonly link?: string;
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: ResendInvitationErrorCode; readonly message: string };
    };

export interface ResendInvitationDeps {
  readonly invitations: HostInvitationRepository;
  readonly inviteHost: InviteHost;
}

/**
 * Sends a fresh link to the same address. It does not revive anything: a link
 * once mailed cannot be recalled, so the only safe resend is one that issues a
 * new invitation and kills the old one at the same moment, leaving exactly one
 * live link.
 *
 * Time can be undone; decisions cannot. An expired invitation may be resent,
 * because expiring is something that happened to it while nobody was looking —
 * and resending is precisely the remedy. An accepted, revoked or superseded one
 * may not, because each is an ending somebody chose, and reaching past it would
 * quietly undo that choice.
 */
export class ResendInvitation {
  constructor(private readonly deps: ResendInvitationDeps) {}

  async execute(id: string, resentBy: string): Promise<ResendInvitationResult> {
    const invitation = await this.deps.invitations.findById(id);
    if (!invitation)
      return {
        ok: false,
        error: { code: 'INVITATION_NOT_FOUND', message: 'No such invitation.' },
      };

    if (wasEndedByDecision(invitation))
      return {
        ok: false,
        error: { code: 'INVITATION_FINISHED', message: 'That invitation is finished.' },
      };

    // Reuses the issuing path rather than restating token generation and
    // sending, so a resent invitation is in every way an ordinary one.
    const issued = await this.deps.inviteHost.execute(invitation.email, resentBy);
    if (!issued.ok)
      return {
        ok: false,
        error: { code: 'RESEND_FAILED', message: issued.error.message },
      };

    await this.deps.invitations.markSuperseded(invitation.id, issued.invitationId);
    // The outcome is the issuing path's to report; nothing is re-decided here.
    return { ok: true, invitationId: issued.invitationId, messageSent: issued.messageSent, link: issued.link };
  }
}
