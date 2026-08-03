import { describe, expect, it } from 'vitest';
import type { ContestSummary } from '../../../src/contests/contest-summary.js';
import { FindContestsByName } from '../../../src/contests/use-cases/find-contests-by-name.js';
import type { ListMyContests } from '../../../src/contests/use-cases/list-my-contests.js';

/** A stub ListMyContests returning a fixed set for one host, empty for others. */
function listStub(hostId: string, summaries: ContestSummary[]): ListMyContests {
  return {
    execute: (id: string) => (id === hostId ? summaries : []),
  } as unknown as ListMyContests;
}

const summary = (id: string, name: string): ContestSummary => ({
  id,
  name,
  status: 'live',
  updatedAt: '2026-01-01T00:00:00.000Z',
});

describe('FindContestsByName', async () => {
  it('finds a contest by its exact name', async () => {
    const find = new FindContestsByName(listStub('h1', [summary('c1', 'Tapas Night')]));
    const found = await find.execute('h1', 'Tapas Night');
    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe('c1');
  });

  it('matches case-insensitively', async () => {
    const find = new FindContestsByName(listStub('h1', [summary('c1', 'Tapas Night')]));
    expect(await find.execute('h1', 'tapas night')).toHaveLength(1);
    expect(await find.execute('h1', 'TAPAS NIGHT')).toHaveLength(1);
  });

  it('does not match a partial name', async () => {
    const find = new FindContestsByName(listStub('h1', [summary('c1', 'Tapas Night')]));
    expect(await find.execute('h1', 'Tapas')).toEqual([]);
    expect(await find.execute('h1', 'Night')).toEqual([]);
  });

  it('returns every contest that shares the name', async () => {
    const find = new FindContestsByName(
      listStub('h1', [summary('c1', 'Tapas Night'), summary('c2', 'Tapas Night'), summary('c3', 'Paella')]),
    );
    const found = await find.execute('h1', 'Tapas Night');
    expect(found.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('returns nothing when no name matches', async () => {
    const find = new FindContestsByName(listStub('h1', [summary('c1', 'Tapas Night')]));
    expect(await find.execute('h1', 'Paella Sunday')).toEqual([]);
  });

  it('searches only the given host (delegates ownership to the list)', async () => {
    const find = new FindContestsByName(listStub('h1', [summary('c1', 'Tapas Night')]));
    expect(await find.execute('someone-else', 'Tapas Night')).toEqual([]);
  });

  it('treats a blank name as no match rather than matching everything', async () => {
    const find = new FindContestsByName(listStub('h1', [summary('c1', 'Tapas Night')]));
    expect(await find.execute('h1', '   ')).toEqual([]);
  });
});
