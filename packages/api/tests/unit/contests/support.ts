import {
  AuditRecorder,
  createAuditProjection,
  type ContestRepository,
  type StoredContest,
} from '../../../src/index.js';
import { FakeAuditLog, FakeDraftRepository } from '../drafts/support.js';
import { FakeRosterRepository } from '../voters/support.js';

export class FakeContestRepository implements ContestRepository {
  private readonly store = new Map<string, StoredContest>();
  async insert(contest: StoredContest): Promise<void> {
    this.store.set(contest.id, contest);
  }
  async findById(id: string): Promise<StoredContest | undefined> {
    return this.store.get(id);
  }
  async findByJoinCode(joinCode: string): Promise<StoredContest | undefined> {
    return [...this.store.values()].find((contest) => contest.joinCode === joinCode);
  }
  async findByHost(hostId: string): Promise<StoredContest[]> {
    return [...this.store.values()].filter((contest) => contest.hostId === hostId);
  }
  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
  async updateStatus(
    id: string,
    status: StoredContest['status'],
    closedAt: string | null,
    revealedAt: string | null,
  ): Promise<void> {
    const contest = this.store.get(id);
    if (contest) this.store.set(id, { ...contest, status, closedAt, revealedAt });
  }
}

export function makePublishDeps() {
  const drafts = new FakeDraftRepository();
  const contests = new FakeContestRepository();
  const roster = new FakeRosterRepository();
  const auditLog = new FakeAuditLog();
  let auditSequence = 0;
  const ids = { next: () => `audit-${++auditSequence}` };
  const clock = { now: () => '2026-07-19T10:00:00.000Z' };
  let joinCodeSequence = 0;
  const joinCodes = { next: () => `JOIN-${++joinCodeSequence}` };
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids }));
  return {
    drafts,
    contests,
    roster,
    auditLog,
    deps: { drafts, contests, roster, audit, clock, joinCodes },
  };
}
