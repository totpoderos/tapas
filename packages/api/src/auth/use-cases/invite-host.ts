import { Email, type HostRole } from '@tapas/domain';
import type { Clock, IdGenerator } from '../../audit/audit-projection.js';
import type { HostAccountRepository } from '../../db/host-account-repository.js';
import type { HostInvitationRepository } from '../../db/host-invitation-repository.js';
import type { Mailer } from '../../mail/mailer.js';
import { generateSecretToken, hashSecretToken } from '../random-token.js';

export type InviteHostErrorCode = 'INVALID_EMAIL' | 'EMAIL_TAKEN';

export type InviteHostResult =
  | { readonly ok: true; readonly invitationId: string }
  | {
      readonly ok: false;
      readonly error: { readonly code: InviteHostErrorCode; readonly message: string };
    };

export interface InviteHostDeps {
  readonly invitations: HostInvitationRepository;
  readonly accounts: HostAccountRepository;
  readonly mailer: Mailer;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  /** Where the acceptance page lives; the token is appended to it. */
  readonly linkBase: string;
}

/**
 * Invites an address to become a host. The raw token exists in the sent message
 * and nowhere else — only its hash is stored.
 *
 * An address that already has an account is refused here rather than at
 * acceptance: `RegisterHost` would refuse it at the very end, after the invited
 * person had followed a good link and chosen a password. Refusing at the point
 * of invitation keeps the failure with the administrator, who can act on it.
 */
export class InviteHost {
  constructor(private readonly deps: InviteHostDeps) {}

  async execute(
    rawEmail: string,
    invitedBy: string,
    invitedRole: HostRole = 'host',
  ): Promise<InviteHostResult> {
    const emailResult = Email.create(rawEmail);
    if (!emailResult.ok)
      return { ok: false, error: { code: 'INVALID_EMAIL', message: emailResult.error.message } };

    const email = emailResult.email.value;
    if (this.deps.accounts.findByEmail(email))
      return {
        ok: false,
        error: { code: 'EMAIL_TAKEN', message: 'That address is already registered.' },
      };

    const token = generateSecretToken();
    const invitation = {
      id: this.deps.ids.next(),
      email,
      tokenHash: hashSecretToken(token),
      status: 'pending' as const,
      issuedBy: invitedBy,
      issuedAt: this.deps.clock.now(),
      acceptedAt: null,
      revokedAt: null,
      supersededBy: null,
      invitedRole,
    };
    this.deps.invitations.insert(invitation);

    // Stored first, then sent: a send that fails leaves an invitation that
    // exists rather than one that was lost.
    await this.deps.mailer.send({ to: email, link: `${this.deps.linkBase}/${token}` });

    return { ok: true, invitationId: invitation.id };
  }
}
