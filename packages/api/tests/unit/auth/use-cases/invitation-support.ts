import type {
  HostInvitationRepository,
  StoredInvitation,
} from '../../../../src/db/host-invitation-repository.js';

export class FakeInvitationRepository implements HostInvitationRepository {
  readonly stored: StoredInvitation[] = [];

  async insert(invitation: StoredInvitation): Promise<void> {
    this.stored.push(invitation);
  }

  async findByTokenHash(tokenHash: string): Promise<StoredInvitation | undefined> {
    return this.stored.find((invitation) => invitation.tokenHash === tokenHash);
  }

  async findById(id: string): Promise<StoredInvitation | undefined> {
    return this.stored.find((invitation) => invitation.id === id);
  }

  async listAll(): Promise<StoredInvitation[]> {
    return [...this.stored];
  }

  async markAccepted(id: string, acceptedAt: string): Promise<void> {
    this.patch(id, { status: 'accepted', acceptedAt });
  }

  async markRevoked(id: string, revokedAt: string): Promise<void> {
    this.patch(id, { status: 'revoked', revokedAt });
  }

  async markSuperseded(id: string, supersededBy: string): Promise<void> {
    this.patch(id, { status: 'superseded', supersededBy });
  }

  async recordHandoff(id: string, messageSent: boolean): Promise<void> {
    this.patch(id, { messageSent });
  }

  private patch(id: string, fields: Partial<StoredInvitation>): void {
    const index = this.stored.findIndex((invitation) => invitation.id === id);
    if (index >= 0) this.stored[index] = { ...this.stored[index]!, ...fields };
  }
}

/** A pending invitation, with the fields a spec rarely cares about already filled in. */
export function pendingInvitation(overrides: Partial<StoredInvitation> = {}): StoredInvitation {
  return {
    id: 'inv-1',
    email: 'nuevo@example.com',
    tokenHash: 'the-hash',
    status: 'pending',
    issuedBy: 'admin-1',
    issuedAt: '2026-07-29T10:00:00.000Z',
    acceptedAt: null,
    revokedAt: null,
    supersededBy: null,
    invitedRole: 'host',
    messageSent: true,
    ...overrides,
  };
}

export class SequentialIds {
  private next_ = 0;
  next(): string {
    this.next_ += 1;
    return `id-${this.next_}`;
  }
}

export const FIXED_CLOCK = { now: () => '2026-07-29T10:00:00.000Z' };
