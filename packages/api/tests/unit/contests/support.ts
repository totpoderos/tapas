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
  insert(contest: StoredContest): void {
    this.store.set(contest.id, contest);
  }
  findById(id: string): StoredContest | undefined {
    return this.store.get(id);
  }
  findByJoinCode(joinCode: string): StoredContest | undefined {
    return [...this.store.values()].find((contest) => contest.joinCode === joinCode);
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
