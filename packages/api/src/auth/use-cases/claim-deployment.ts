import type { HostAccountRepository } from '../../db/host-account-repository.js';
import type { HostInvitationRepository } from '../../db/host-invitation-repository.js';
import type { InviteHost } from './invite-host.js';

export type ClaimDeploymentErrorCode = 'SETUP_COMPLETE' | 'CLAIM_REFUSED';

export type ClaimDeploymentResult =
  | {
      readonly ok: true;
      readonly invitationId: string;
      readonly messageSent: boolean;
      readonly link?: string;
    }
  | {
      readonly ok: false;
      readonly error: { readonly code: ClaimDeploymentErrorCode; readonly message: string };
    };

export interface ClaimDeploymentDeps {
  readonly accounts: HostAccountRepository;
  readonly invitations: HostInvitationRepository;
  readonly inviteHost: InviteHost;
  /** The address named in configuration — the only one that may claim this deployment. */
  readonly configuredEmail: string;
}

/**
 * Lets the configured address claim a deployment that has no administrator yet.
 *
 * The email round-trip is not what secures this. It proves only that whoever
 * clicks holds the inbox they typed, which at first run would be their own — an
 * attacker owns their inbox exactly as well as an operator owns theirs. What
 * secures it is that the address was chosen out of band by whoever controls the
 * deployment's configuration.
 *
 * Claiming again while an invitation is outstanding sends a fresh link and ends
 * the previous one. Refusing instead would leave a deployment unclaimable for a
 * whole day whenever a message went astray, with no remedy — resending needs an
 * administrator, and the entire problem is that there is not one. This is safe
 * only because the address is fixed: every such message goes to one inbox.
 */
export class ClaimDeployment {
  constructor(private readonly deps: ClaimDeploymentDeps) {}

  async isUnclaimed(): Promise<boolean> {
    return !(await this.deps.accounts.listAll()).some((account) => account.role === 'admin');
  }

  async execute(rawEmail: string): Promise<ClaimDeploymentResult> {
    if (!(await this.isUnclaimed()))
      return {
        ok: false,
        error: { code: 'SETUP_COMPLETE', message: 'This deployment already has an administrator.' },
      };

    // Compared case-insensitively: an address is not case-sensitive in its
    // domain, and an operator typing their own address differently from the
    // configuration should not be locked out of their own deployment.
    if (rawEmail.trim().toLowerCase() !== this.deps.configuredEmail.trim().toLowerCase())
      // Says nothing about what the configured address is: echoing it, or even
      // saying "that is not it", would turn an anonymous route into a way to
      // read part of the deployment's configuration.
      return { ok: false, error: { code: 'CLAIM_REFUSED', message: 'Claim refused.' } };

    const outstanding = (await this.deps.invitations
      .listAll())
      .filter((invitation) => invitation.invitedRole === 'admin' && invitation.status === 'pending');

    const issued = await this.deps.inviteHost.execute(
      this.deps.configuredEmail,
      'system:setup',
      'admin',
    );
    if (!issued.ok) return { ok: false, error: { code: 'CLAIM_REFUSED', message: 'Claim refused.' } };

    for (const previous of outstanding)
      await this.deps.invitations.markSuperseded(previous.id, issued.invitationId);

    // A first-run deployment has no administrator to resend for it, so the link
    // in this answer is the only remedy when no mail server would take the message.
    return { ok: true, invitationId: issued.invitationId, messageSent: issued.messageSent, link: issued.link };
  }
}
