import { describe, expect, it } from 'vitest';
import { ListMyContests, type StoredContest } from '../../../src/index.js';
import type { StoredDraft } from '../../../src/index.js';
import { FakeContestRepository } from './support.js';
import { FakeDraftRepository } from '../drafts/support.js';
import { FakeRosterRepository } from '../voters/support.js';
import { FakeVoteSessionRepository } from '../scoring/support.js';

function draft(overrides: Partial<StoredDraft> & { id: string; hostId: string }): StoredDraft {
  return {
    content: { name: overrides.id, participants: [] },
    status: 'draft',
    createdAt: '2026-07-19T10:00:00.000Z',
    updatedAt: '2026-07-19T10:00:00.000Z',
    ...overrides,
  };
}

function contest(
  overrides: Partial<StoredContest> & { id: string; hostId: string; status: StoredContest['status'] },
): StoredContest {
  return {
    name: overrides.id,
    joinCode: `JOIN-${overrides.id}`,
    materialized: {
      dishes: [],
      allowedVoters: new Map(),
      scoreRangeByVoter: new Map(),
      uniquePerCategory: false,
      categories: [],
    } as StoredContest['materialized'],
    closeRule: { when: 'host_trigger' },
    revealStrategy: { when: 'host_trigger' },
    createdAt: '2026-07-19T10:00:00.000Z',
    closedAt: null,
    revealedAt: null,
    ...overrides,
  };
}

/** A materialized view with `count` scoring categories, for the rules-in-brief. */
function withCategories(count: number): StoredContest['materialized'] {
  return {
    dishes: [],
    allowedVoters: new Map(),
    scoreRangeByVoter: new Map(),
    uniquePerCategory: false,
    categories: Array.from({ length: count }, (_, i) => ({ id: `c${i}`, name: `Category ${i}` })),
  } as StoredContest['materialized'];
}

function makeUseCase() {
  const drafts = new FakeDraftRepository();
  const contests = new FakeContestRepository();
  const roster = new FakeRosterRepository();
  const voteSessions = new FakeVoteSessionRepository();
  return {
    drafts,
    contests,
    roster,
    voteSessions,
    listMyContests: new ListMyContests({ drafts, contests, roster, voteSessions }),
  };
}

describe('ListMyContests', async () => {
  it('merges a host’s drafts and published contests, each marked with its state', async () => {
    const { drafts, contests, listMyContests } = makeUseCase();
    await drafts.insert(draft({ id: 'd1', hostId: 'ana', content: { name: 'Summer Tapas', participants: [] } }));
    await contests.insert(contest({ id: 'c1', hostId: 'ana', name: 'Balcony Cook-off', status: 'live' }));
    await contests.insert(
      contest({
        id: 'c2',
        hostId: 'ana',
        name: 'Winter Feast',
        status: 'revealed',
        revealedAt: '2026-07-20T10:00:00.000Z',
      }),
    );

    const summaries = await listMyContests.execute('ana');

    expect(summaries).toHaveLength(3);
    const byName = Object.fromEntries(summaries.map((s) => [s.name, s.status]));
    expect(byName).toEqual({
      'Summer Tapas': 'draft',
      'Balcony Cook-off': 'live',
      'Winter Feast': 'revealed',
    });
  });

  it('marks a contest whose voting has closed as closed', async () => {
    const { contests, listMyContests } = makeUseCase();
    await contests.insert(
      contest({
        id: 'c1',
        hostId: 'ana',
        name: 'Rooftop Rounds',
        status: 'closed',
        closedAt: '2026-07-20T10:00:00.000Z',
      }),
    );

    expect(await listMyContests.execute('ana')).toEqual([
      {
        id: 'c1',
        name: 'Rooftop Rounds',
        status: 'closed',
        updatedAt: '2026-07-20T10:00:00.000Z',
        categoryCount: 0,
        joinCode: 'JOIN-c1',
        progress: { claimedCount: 0, draftCount: 0, sentCount: 0 },
      },
    ]);
  });

  it('returns an empty list for a host with nothing', async () => {
    const { listMyContests } = makeUseCase();
    expect(await listMyContests.execute('ana')).toEqual([]);
  });

  it('returns only the given host’s items', async () => {
    const { drafts, contests, listMyContests } = makeUseCase();
    await drafts.insert(draft({ id: 'd1', hostId: 'ana', content: { name: 'Ana’s Tapas', participants: [] } }));
    await contests.insert(contest({ id: 'c1', hostId: 'bob', name: 'Bob’s Cook-off', status: 'live' }));

    const summaries = await listMyContests.execute('ana');

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.name).toBe('Ana’s Tapas');
  });

  it('orders the most recently touched first', async () => {
    const { drafts, contests, listMyContests } = makeUseCase();
    await drafts.insert(
      draft({
        id: 'd1',
        hostId: 'ana',
        content: { name: 'Older draft', participants: [] },
        updatedAt: '2026-07-18T10:00:00.000Z',
      }),
    );
    await contests.insert(
      contest({
        id: 'c1',
        hostId: 'ana',
        name: 'Newer reveal',
        status: 'revealed',
        revealedAt: '2026-07-22T10:00:00.000Z',
      }),
    );

    expect((await listMyContests.execute('ana')).map((s) => s.name)).toEqual(['Newer reveal', 'Older draft']);
  });
});

/**
 * What a host can read off the list without opening anything. The distinction
 * that matters throughout: a contest still being prepared reports *nothing* for
 * what it cannot have yet, never a zero — "not published" and "nobody has voted"
 * are different answers and a host must not have to tell them apart by guessing.
 */
describe('ListMyContests — how each contest is going', async () => {
  it('reports how far along a live contest’s voting is', async () => {
    const { contests, roster, voteSessions, listMyContests } = makeUseCase();
    await contests.insert(contest({ id: 'c1', hostId: 'ana', status: 'live' }));
    await roster.seed('c1', [
      { participantId: 'p1', displayName: 'Isabel' },
      { participantId: 'p2', displayName: 'Tomás' },
      { participantId: 'p3', displayName: 'Núria' },
      { participantId: 'p4', displayName: 'Pau' },
    ]);
    for (const id of ['p1', 'p2', 'p3', 'p4']) await roster.claim('c1', id, '2026-07-20T10:00:00.000Z');
    // Two sent, one still scoring, one has not started.
    await voteSessions.createSession({
      id: 's1',
      contestId: 'c1',
      voterId: 'p1',
      status: 'sent',
      createdAt: 'x',
      submittedAt: 'y',
    });
    await voteSessions.createSession({
      id: 's2',
      contestId: 'c1',
      voterId: 'p2',
      status: 'sent',
      createdAt: 'x',
      submittedAt: 'y',
    });
    await voteSessions.createSession({
      id: 's3',
      contestId: 'c1',
      voterId: 'p3',
      status: 'draft',
      createdAt: 'x',
      submittedAt: null,
    });

    expect((await listMyContests.execute('ana'))[0]?.progress).toEqual({
      claimedCount: 4,
      draftCount: 1,
      sentCount: 2,
    });
  });

  it('reports a live contest nobody has joined as a real nothing, not as absent', async () => {
    const { contests, listMyContests } = makeUseCase();
    await contests.insert(contest({ id: 'c1', hostId: 'ana', status: 'live' }));

    // It is published, so the counts apply — they are simply all nought. That is
    // a different statement from a draft, which has no progress at all.
    expect((await listMyContests.execute('ana'))[0]?.progress).toEqual({
      claimedCount: 0,
      draftCount: 0,
      sentCount: 0,
    });
  });

  it('reports a published contest’s rules in brief and its join code', async () => {
    const { contests, listMyContests } = makeUseCase();
    await contests.insert(
      contest({
        id: 'c1',
        hostId: 'ana',
        status: 'live',
        format: 'solo',
        materialized: withCategories(3),
      }),
    );

    const summary = (await listMyContests.execute('ana'))[0];
    expect(summary?.format).toBe('solo');
    expect(summary?.categoryCount).toBe(3);
    expect(summary?.joinCode).toBe('JOIN-c1');
  });

  it('says nothing about the format of a contest that does not record one', async () => {
    const { contests, listMyContests } = makeUseCase();
    // A contest that records no format: unknown, and left unknown rather
    // than guessed back out of the compiled dish shapes.
    await contests.insert(contest({ id: 'c1', hostId: 'ana', status: 'live' }));

    expect((await listMyContests.execute('ana'))[0]).not.toHaveProperty('format');
  });

  it('gives a contest being prepared no join code and no progress at all', async () => {
    const { drafts, listMyContests } = makeUseCase();
    await drafts.insert(draft({ id: 'd1', hostId: 'ana' }));

    const summary = (await listMyContests.execute('ana'))[0];
    expect(summary).not.toHaveProperty('joinCode');
    expect(summary).not.toHaveProperty('progress');
    // Emphatically not zeroes: that would read as "nobody has voted".
    expect(summary?.progress).toBeUndefined();
  });

  it('still reports the rules a draft has been given', async () => {
    const { drafts, listMyContests } = makeUseCase();
    await drafts.insert(
      draft({
        id: 'd1',
        hostId: 'ana',
        content: {
          name: 'Barrio Supper Club',
          format: 'couples',
          scoring: {
            categories: [
              { id: 'c1', name: 'Taste' },
              { id: 'c2', name: 'Look' },
            ],
            range: { type: 'auto' },
            uniquePerCategory: false,
          },
        },
      }),
    );

    const summary = (await listMyContests.execute('ana'))[0];
    expect(summary?.format).toBe('couples');
    expect(summary?.categoryCount).toBe(2);
  });

  it('says nothing about the rules a draft has not been given', async () => {
    const { drafts, listMyContests } = makeUseCase();
    await drafts.insert(draft({ id: 'd1', hostId: 'ana', content: { name: 'Just a name' } }));

    const summary = (await listMyContests.execute('ana'))[0];
    expect(summary).not.toHaveProperty('format');
    expect(summary).not.toHaveProperty('categoryCount');
  });

  it('asks for the counts once for the whole list, not once per contest', async () => {
    const { drafts, contests, roster, voteSessions, listMyContests } = makeUseCase();
    for (let i = 0; i < 6; i += 1) {
      await contests.insert(contest({ id: `c${i}`, hostId: 'ana', status: 'live' }));
    }
    await drafts.insert(draft({ id: 'd1', hostId: 'ana' }));

    const asks = { roster: 0, sessions: 0 };
    const countClaimed = roster.countClaimedByContest.bind(roster);
    const countSessions = voteSessions.countSessionsByContest.bind(voteSessions);
    roster.countClaimedByContest = (ids) => {
      asks.roster += 1;
      return countClaimed(ids);
    };
    voteSessions.countSessionsByContest = (ids) => {
      asks.sessions += 1;
      return countSessions(ids);
    };

    expect(await listMyContests.execute('ana')).toHaveLength(7);
    // Six contests, one ask each way. Per-contest reads would be six and six.
    expect(asks).toEqual({ roster: 1, sessions: 1 });
  });

  it('asks about nothing when the host has only drafts', async () => {
    const { drafts, roster, listMyContests } = makeUseCase();
    await drafts.insert(draft({ id: 'd1', hostId: 'ana' }));

    let asked: readonly string[] | undefined;
    const countClaimed = roster.countClaimedByContest.bind(roster);
    roster.countClaimedByContest = (ids) => {
      asked = ids;
      return countClaimed(ids);
    };
    await listMyContests.execute('ana');

    // An empty list of ids, which the repositories must short-circuit — `IN ()`
    // is not valid SQL.
    expect(asked).toEqual([]);
  });
});
