import { describe, expect, it } from 'vitest';
import { AuditRecorder, RevealContest, createAuditProjection } from '../../../../src/index.js';
import { FakeContestRepository } from '../support.js';
import { FakeAuditLog } from '../../drafts/support.js';

function makeDeps() {
  const contests = new FakeContestRepository();
  const clock = { now: () => '2026-07-21T10:00:00.000Z' };
  const auditLog = new FakeAuditLog();
  let seq = 0;
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids: { next: () => `a-${++seq}` } }));
  return { contests, clock, audit, auditLog };
}

const AS_HOST = { actorId: 'host-1', confirmation: 'host' as const };

function contestWith(overrides: Partial<Parameters<FakeContestRepository['insert']>[0]> = {}) {
  return {
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Summer',
    joinCode: 'JOIN-1',
    status: 'closed' as const,
    materialized: {
      dishes: [],
      allowedVoters: new Map(),
      scoreRangeByVoter: new Map(),
      uniquePerCategory: true,
      categories: [],
    },
    closeRule: { when: 'host_trigger' as const },
    revealStrategy: { when: 'host_trigger' as const },
    createdAt: '2026-07-19T10:00:00.000Z',
    closedAt: '2026-07-20T10:00:00.000Z',
    revealedAt: null,
    ...overrides,
  };
}

describe('RevealContest', () => {
  it('reveals a closed contest and records the reveal in the audit log', () => {
    const { contests, clock, audit, auditLog } = makeDeps();
    contests.insert(contestWith());

    const outcome = new RevealContest({ contests, clock, audit }).execute('contest-1', AS_HOST);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.contest.status).toBe('revealed');
    expect(outcome.contest.revealedAt).toBe('2026-07-21T10:00:00.000Z');
    expect(contests.findById('contest-1')?.status).toBe('revealed');
    const entry = auditLog.entries.at(-1);
    expect(entry?.type).toBe('contest.revealed');
    expect(entry?.confirmation).toBe('host');
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest, recording nothing', () => {
    const { contests, clock, audit, auditLog } = makeDeps();

    const outcome = new RevealContest({ contests, clock, audit }).execute('unknown', AS_HOST);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
    expect(auditLog.entries).toHaveLength(0);
  });

  it('refuses to reveal a contest that has not closed yet', () => {
    const { contests, clock, audit } = makeDeps();
    contests.insert(contestWith({ status: 'live', closedAt: null }));

    const outcome = new RevealContest({ contests, clock, audit }).execute('contest-1', AS_HOST);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('NOT_CLOSED');
  });

  it('refuses to reveal an already-revealed contest', () => {
    const { contests, clock, audit } = makeDeps();
    contests.insert(contestWith({ status: 'revealed', revealedAt: '2026-07-20T11:00:00.000Z' }));

    const outcome = new RevealContest({ contests, clock, audit }).execute('contest-1', AS_HOST);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('ALREADY_REVEALED');
  });
});
