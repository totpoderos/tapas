import { describe, expect, it } from 'vitest';
import { ListMyContests, type StoredContest } from '../../../src/index.js';
import type { StoredDraft } from '../../../src/index.js';
import { FakeContestRepository } from './support.js';
import { FakeDraftRepository } from '../drafts/support.js';

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

function makeUseCase() {
  const drafts = new FakeDraftRepository();
  const contests = new FakeContestRepository();
  return { drafts, contests, listMyContests: new ListMyContests({ drafts, contests }) };
}

describe('ListMyContests', () => {
  it('merges a host’s drafts and published contests, each marked with its state', () => {
    const { drafts, contests, listMyContests } = makeUseCase();
    drafts.insert(draft({ id: 'd1', hostId: 'ana', content: { name: 'Summer Tapas', participants: [] } }));
    contests.insert(contest({ id: 'c1', hostId: 'ana', name: 'Balcony Cook-off', status: 'live' }));
    contests.insert(
      contest({
        id: 'c2',
        hostId: 'ana',
        name: 'Winter Feast',
        status: 'revealed',
        revealedAt: '2026-07-20T10:00:00.000Z',
      }),
    );

    const summaries = listMyContests.execute('ana');

    expect(summaries).toHaveLength(3);
    const byName = Object.fromEntries(summaries.map((s) => [s.name, s.status]));
    expect(byName).toEqual({
      'Summer Tapas': 'draft',
      'Balcony Cook-off': 'live',
      'Winter Feast': 'revealed',
    });
  });

  it('marks a contest whose voting has closed as closed', () => {
    const { contests, listMyContests } = makeUseCase();
    contests.insert(
      contest({
        id: 'c1',
        hostId: 'ana',
        name: 'Rooftop Rounds',
        status: 'closed',
        closedAt: '2026-07-20T10:00:00.000Z',
      }),
    );

    expect(listMyContests.execute('ana')).toEqual([
      { id: 'c1', name: 'Rooftop Rounds', status: 'closed', updatedAt: '2026-07-20T10:00:00.000Z' },
    ]);
  });

  it('returns an empty list for a host with nothing', () => {
    const { listMyContests } = makeUseCase();
    expect(listMyContests.execute('ana')).toEqual([]);
  });

  it('returns only the given host’s items', () => {
    const { drafts, contests, listMyContests } = makeUseCase();
    drafts.insert(draft({ id: 'd1', hostId: 'ana', content: { name: 'Ana’s Tapas', participants: [] } }));
    contests.insert(contest({ id: 'c1', hostId: 'bob', name: 'Bob’s Cook-off', status: 'live' }));

    const summaries = listMyContests.execute('ana');

    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.name).toBe('Ana’s Tapas');
  });

  it('orders the most recently touched first', () => {
    const { drafts, contests, listMyContests } = makeUseCase();
    drafts.insert(
      draft({
        id: 'd1',
        hostId: 'ana',
        content: { name: 'Older draft', participants: [] },
        updatedAt: '2026-07-18T10:00:00.000Z',
      }),
    );
    contests.insert(
      contest({
        id: 'c1',
        hostId: 'ana',
        name: 'Newer reveal',
        status: 'revealed',
        revealedAt: '2026-07-22T10:00:00.000Z',
      }),
    );

    expect(listMyContests.execute('ana').map((s) => s.name)).toEqual(['Newer reveal', 'Older draft']);
  });
});
