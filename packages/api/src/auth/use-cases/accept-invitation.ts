import type { HostRole } from '@tapas/domain';
import type { Clock } from '../../audit/audit-projection.js';
import type { HostInvitationRepository } from '../../db/host-invitation-repository.js';
import { hashSecretToken } from '../random-token.js';
import { INVITATION_UNUSABLE, usabilityOf, type UnusableReason } from './invitation-shared.js';
import type { RegisterHost } from './register-host.js';
import type { RegisterErrorCode } from './shared.js';

export type AcceptInvitationResult =
  | { readonly ok: true; readonly hostId: string; readonly createdRole: HostRole }
  | {
      readonly ok: false;
      readonly error:
        | typeof INVITATION_UNUSABLE
        | { readonly code: RegisterErrorCode; readonly message: string };
      /** Why the link did not work — for the log only; never part of the refusal. */
      readonly reason?: UnusableReason;
    };

export interface AcceptInvitationDeps {
  readonly invitations: HostInvitationRepository;
  readonly registerHost: RegisterHost;
  readonly clock: Clock;
}

/**
 * Turns an invitation into a host account. Account creation is delegated to
 * `RegisterHost` rather than restated, so the invited path and the open
 * registration path cannot drift on what a valid account is — and when the open
 * path is removed, the use case stays and only its other caller disappears.
 *
 * The invitation is marked accepted only once the account exists. A password
 * that fails the policy leaves it pending: with no resend until a later slice,
 * an invitation spent by a mistyped password would strand its recipient.
 */
export class AcceptInvitation {
  constructor(private readonly deps: AcceptInvitationDeps) {}

  async execute(rawToken: string, rawPassword: string): Promise<AcceptInvitationResult> {
    const found = await this.deps.invitations.findByTokenHash(hashSecretToken(rawToken));
    const usability = usabilityOf(found, this.deps.clock.now());
    if (!usability.usable)
      return { ok: false, error: INVITATION_UNUSABLE, reason: usability.reason };

    const invitation = usability.invitation;
    const registration = await this.deps.registerHost.execute(
      invitation.email,
      rawPassword,
      invitation.invitedRole,
    );
    if (!registration.ok) return { ok: false, error: registration.error };

    await this.deps.invitations.markAccepted(invitation.id, this.deps.clock.now());
    return { ok: true, hostId: registration.hostId, createdRole: invitation.invitedRole };
  }
}
