import { describe, expect, it } from 'vitest';
import type { ContestSummary } from '../../../src/contests/contest-summary.js';
import type { FindContestsByName } from '../../../src/contests/use-cases/find-contests-by-name.js';
import { ResolveContestByName } from '../../../src/contests/use-cases/resolve-contest-by-name.js';

/** A stub FindContestsByName returning a fixed set for one host, empty for others. */
function findStub(hostId: string, summaries: ContestSummary[]): FindContestsByName {
  return {
    execute: (id: string, name: string) =>
      id === hostId ? summaries.filter((s) => s.name.toLowerCase() === name.trim().toLowerCase()) : [],
  } as unknown as FindContestsByName;
}

const summary = (
  id: string,
  name: string,
  status: ContestSummary['status'] = 'live',
): ContestSummary => ({ id, name, status, updatedAt: '2026-01-01T00:00:00.000Z' });

describe('ResolveContestByName', () => {
  it('resolves a name only one contest bears', () => {
    const resolve = new ResolveContestByName(findStub('h1', [summary('c1', 'Tapas Night')]));
    const result = resolve.execute('h1', 'Tapas Night');
    expect(result.kind).toBe('one');
    if (result.kind !== 'one') return;
    expect(result.contest.id).toBe('c1');
  });

  it('matches without regard to case', () => {
    const resolve = new ResolveContestByName(findStub('h1', [summary('c1', 'Tapas Night')]));
    expect(resolve.execute('h1', 'tapas night').kind).toBe('one');
  });

  /*
   * The distinction the whole surface rests on: a shared name must resolve to
   * "several", never to whichever came back first, so no action can land on a
   * contest the host did not mean.
   */
  it('offers the candidates when several contests share the name', () => {
    const both = [summary('c1', 'Tapas Night'), summary('c2', 'Tapas Night')];
    const resolve = new ResolveContestByName(findStub('h1', both));
    const result = resolve.execute('h1', 'Tapas Night');
    expect(result.kind).toBe('several');
    if (result.kind !== 'several') return;
    expect(result.candidates.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('reports nothing found for a name no contest bears', () => {
    const resolve = new ResolveContestByName(findStub('h1', [summary('c1', 'Tapas Night')]));
    expect(resolve.execute('h1', 'Sunday Roast').kind).toBe('none');
  });

  /*
   * Not "refused as not allowed": only the host's own contests are ever
   * searched, so another host's contest is not there to refuse. That is also why
   * a 403 never leaks the existence of a contest by name.
   */
  it('never reaches another host’s contest', () => {
    const resolve = new ResolveContestByName(findStub('h1', [summary('c1', 'Tapas Night')]));
    expect(resolve.execute('h2', 'Tapas Night').kind).toBe('none');
  });

  it('reports nothing found for an empty name', () => {
    const resolve = new ResolveContestByName(findStub('h1', [summary('c1', 'Tapas Night')]));
    expect(resolve.execute('h1', '   ').kind).toBe('none');
  });

  describe('narrowed to drafts', () => {
    it('resolves a draft by name', () => {
      const resolve = new ResolveContestByName(findStub('h1', [summary('d1', 'Tapas Night', 'draft')]));
      const result = resolve.execute('h1', 'Tapas Night', { only: 'draft' });
      expect(result.kind).toBe('one');
      if (result.kind !== 'one') return;
      expect(result.contest.id).toBe('d1');
    });

    /*
     * A published contest bearing the name is not a candidate for a draft-only
     * action, and must not make the name look ambiguous either — otherwise
     * re-running a contest under the same name would block every edit to the new
     * draft.
     */
    it('ignores a published contest sharing the name', () => {
      const mixed = [summary('c1', 'Tapas Night'), summary('d1', 'Tapas Night', 'draft')];
      const resolve = new ResolveContestByName(findStub('h1', mixed));
      const result = resolve.execute('h1', 'Tapas Night', { only: 'draft' });
      expect(result.kind).toBe('one');
      if (result.kind !== 'one') return;
      expect(result.contest.id).toBe('d1');
    });

    it('reports nothing found when only a published contest bears the name', () => {
      const resolve = new ResolveContestByName(findStub('h1', [summary('c1', 'Tapas Night')]));
      expect(resolve.execute('h1', 'Tapas Night', { only: 'draft' }).kind).toBe('none');
    });

    it('offers the candidates when several drafts share the name', () => {
      const both = [summary('d1', 'Tapas Night', 'draft'), summary('d2', 'Tapas Night', 'draft')];
      const resolve = new ResolveContestByName(findStub('h1', both));
      expect(resolve.execute('h1', 'Tapas Night', { only: 'draft' }).kind).toBe('several');
    });
  });
});
