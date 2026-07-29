import type { Clock } from '../../audit/audit-projection.js';
import type { HostInvitationRepository } from '../../db/host-invitation-repository.js';
import { usabilityOf } from './invitation-shared.js';

/** How an invitation stands, as an administrator sees it — including the one standing that is never stored. */
export type InvitationStanding = 'pending' | 'accepted' | 'revoked' | 'superseded' | 'expired';

export interface InvitationSummary {
  readonly id: string;
  readonly email: string;
  readonly status: InvitationStanding;
  readonly issuedAt: string;
}

export interface ListInvitationsDeps {
  readonly invitations: HostInvitationRepository;
  readonly clock: Clock;
}

/**
 * Lists the invitations for an administrator, who has no token and needs none:
 * an invitation is named here by its id, and that is what revoking and
 * resending take.
 *
 * The standing comes from `usabilityOf` rather than from a fresh comparison of
 * timestamps. An invitation past its window is stored as pending and shown as
 * expired, so this is a second reader of "is this still good?" — and writing
 * that comparison again here is exactly how two answers drift apart.
 */
export class ListInvitations {
  constructor(private readonly deps: ListInvitationsDeps) {}

  execute(): InvitationSummary[] {
    const now = this.deps.clock.now();
    return this.deps.invitations.listAll().map((invitation) => {
      const usability = usabilityOf(invitation, now);
      return {
        id: invitation.id,
        email: invitation.email,
        status: usability.usable ? ('pending' as const) : standingFor(usability.reason),
        issuedAt: invitation.issuedAt,
      };
    });
  }
}

function standingFor(reason: 'unknown' | 'already_accepted' | 'expired' | 'revoked' | 'superseded'): InvitationStanding {
  // 'unknown' cannot arise: every invitation listed came from the store.
  return reason === 'already_accepted' ? 'accepted' : (reason as InvitationStanding);
}
