import { describe, expect, it } from 'vitest';
import type { ContestSummary } from '../../../src/contests/contest-summary.js';
import type { ContestRepository } from '../../../src/db/contest-repository.js';
import type { DraftRepository } from '../../../src/db/draft-repository.js';
import type { RosterRepository } from '../../../src/db/roster-repository.js';
import { GetContestDetails } from '../../../src/contests/use-cases/get-contest-details.js';
import type { FindContestsByName } from '../../../src/contests/use-cases/find-contests-by-name.js';

const summary = (id: string, name: string, status: ContestSummary['status']): ContestSummary => ({
  id,
  name,
  status,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

function build(opts: {
  matches: ContestSummary[];
  drafts?: Partial<DraftRepository>;
  contests?: Partial<ContestRepository>;
  roster?: Partial<RosterRepository>;
}): GetContestDetails {
  return new GetContestDetails({
    findContestsByName: { execute: () => opts.matches } as unknown as FindContestsByName,
    drafts: (opts.drafts ?? {}) as DraftRepository,
    contests: (opts.contests ?? {}) as ContestRepository,
    roster: (opts.roster ?? {}) as RosterRepository,
  });
}

describe('GetContestDetails', () => {
  it("reads a draft's participants and categories by name", () => {
    const get = build({
      matches: [summary('d1', 'Tapas Night', 'draft')],
      drafts: {
        findById: () =>
          ({
            id: 'd1',
            content: {
              name: 'Tapas Night',
              participants: [
                { id: 'a', displayName: 'Ana' },
                { id: 'b', displayName: 'Bob' },
              ],
              scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: false },
            },
          }) as unknown as ReturnType<DraftRepository['findById']>,
      },
    });

    const { details } = get.execute('h1', 'Tapas Night');
    expect(details?.status).toBe('draft');
    expect(details?.participants).toEqual(['Ana', 'Bob']);
    expect(details?.categories).toEqual(['Taste']);
  });

  it("reads a published contest's participants from the roster and categories from the materialised view", () => {
    const get = build({
      matches: [summary('c1', 'Balcony Cook-off', 'live')],
      contests: {
        findById: () =>
          ({
            id: 'c1',
            name: 'Balcony Cook-off',
            status: 'live',
            materialized: { categories: [{ id: 'c1', name: 'Presentation' }] },
          }) as unknown as ReturnType<ContestRepository['findById']>,
      },
      roster: {
        listAll: () => [
          { contestId: 'c1', participantId: 'a', displayName: 'Ana', claimedAt: null },
          { contestId: 'c1', participantId: 'b', displayName: 'Bob', claimedAt: '2026-01-01T00:00:00.000Z' },
        ],
      },
    });

    const { details } = get.execute('h1', 'Balcony Cook-off');
    expect(details?.status).toBe('live');
    expect(details?.participants).toEqual(['Ana', 'Bob']);
    expect(details?.categories).toEqual(['Presentation']);
  });

  it('returns candidates when several contests share the name', () => {
    const matches = [summary('c1', 'Tapas Night', 'live'), summary('c2', 'Tapas Night', 'draft')];
    const { details, candidates } = build({ matches }).execute('h1', 'Tapas Night');
    expect(details).toBeUndefined();
    expect(candidates).toHaveLength(2);
  });

  it('returns no candidates and no details when nothing matches', () => {
    const result = build({ matches: [] }).execute('h1', 'Nope');
    expect(result.details).toBeUndefined();
    expect(result.candidates).toEqual([]);
  });
});
