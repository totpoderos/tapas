import { describe, expect, it } from 'vitest';
import { AuditRecorder, CloseContest, createAuditProjection } from '../../../../src/index.js';
import { FakeContestRepository } from '../support.js';
import { FakeAuditLog } from '../../drafts/support.js';

function liveContest(overrides: Partial<Parameters<FakeContestRepository['insert']>[0]> = {}) {
  return {
    id: 'contest-1',
    hostId: 'host-1',
    name: 'Summer',
    joinCode: 'JOIN-1',
    status: 'live' as const,
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
    closedAt: null,
    revealedAt: null,
    ...overrides,
  };
}

function makeDeps() {
  const contests = new FakeContestRepository();
  const clock = { now: () => '2026-07-21T10:00:00.000Z' };
  const auditLog = new FakeAuditLog();
  let seq = 0;
  const audit = new AuditRecorder(auditLog, createAuditProjection({ clock, ids: { next: () => `a-${++seq}` } }));
  return { contests, clock, audit, auditLog };
}

const AS_HOST = { actorId: 'host-1', confirmation: 'host' as const };

describe('CloseContest', async () => {
  it('closes a live contest and records the close in the audit log', async () => {
    const { contests, clock, audit, auditLog } = makeDeps();
    await contests.insert(liveContest());

    const outcome = await new CloseContest({ contests, clock, audit }).execute('contest-1', AS_HOST);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.contest.status).toBe('closed');
    expect((await contests.findById('contest-1'))?.status).toBe('closed');
    const entry = auditLog.entries.at(-1);
    expect(entry?.type).toBe('contest.closed');
    expect(entry?.actorId).toBe('host-1');
    expect(entry?.confirmation).toBe('host');
  });

  it('records auto when the host did not explicitly confirm', async () => {
    const { contests, clock, audit, auditLog } = makeDeps();
    await contests.insert(liveContest());

    await new CloseContest({ contests, clock, audit }).execute('contest-1', { actorId: 'host-1', confirmation: 'auto' });

    expect(auditLog.entries.at(-1)?.confirmation).toBe('auto');
  });

  it('reports CONTEST_NOT_FOUND for an unknown contest, recording nothing', async () => {
    const { contests, clock, audit, auditLog } = makeDeps();

    const outcome = await new CloseContest({ contests, clock, audit }).execute('unknown', AS_HOST);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('CONTEST_NOT_FOUND');
    expect(auditLog.entries).toHaveLength(0);
  });

  it('refuses to close an already-closed contest, recording nothing', async () => {
    const { contests, clock, audit, auditLog } = makeDeps();
    await contests.insert(liveContest({ status: 'closed', closedAt: '2026-07-20T10:00:00.000Z' }));

    const outcome = await new CloseContest({ contests, clock, audit }).execute('contest-1', AS_HOST);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.error.code).toBe('ALREADY_CLOSED');
    expect(auditLog.entries).toHaveLength(0);
  });
});
