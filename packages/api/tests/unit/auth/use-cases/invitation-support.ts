import type {
  HostInvitationRepository,
  StoredInvitation,
} from '../../../../src/db/host-invitation-repository.js';

export class FakeInvitationRepository implements HostInvitationRepository {
  readonly stored: StoredInvitation[] = [];

  insert(invitation: StoredInvitation): void {
    this.stored.push(invitation);
  }

  findByTokenHash(tokenHash: string): StoredInvitation | undefined {
    return this.stored.find((invitation) => invitation.tokenHash === tokenHash);
  }

  markAccepted(id: string, acceptedAt: string): void {
    const index = this.stored.findIndex((invitation) => invitation.id === id);
    if (index >= 0)
      this.stored[index] = { ...this.stored[index]!, status: 'accepted', acceptedAt };
  }
}

export class SequentialIds {
  private next_ = 0;
  next(): string {
    this.next_ += 1;
    return `id-${this.next_}`;
  }
}

export const FIXED_CLOCK = { now: () => '2026-07-29T10:00:00.000Z' };
