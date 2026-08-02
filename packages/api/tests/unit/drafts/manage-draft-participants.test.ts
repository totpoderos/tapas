import { describe, expect, it } from 'vitest';
import type { DraftContent } from '@tapas/domain';
import type { ContestSummary } from '../../../src/contests/contest-summary.js';
import type { DraftRepository } from '../../../src/db/draft-repository.js';
import type { StoredDraft } from '../../../src/drafts/stored-draft.js';
import type { FindContestsByName } from '../../../src/contests/use-cases/find-contests-by-name.js';
import { ResolveContestByName } from '../../../src/contests/use-cases/resolve-contest-by-name.js';
import type { UpdateDraft } from '../../../src/drafts/use-cases/update-draft.js';
import {
  AddDraftParticipant,
  RemoveDraftParticipant,
  type ManageDraftParticipantsDeps,
} from '../../../src/drafts/use-cases/manage-draft-participants.js';

const summary = (id: string, name: string, status: ContestSummary['status']): ContestSummary => ({
  id,
  name,
  status,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** A workspace where a single draft's content is held in memory and mutated by UpdateDraft. */
function workspace(matches: ContestSummary[], initial?: DraftContent) {
  let content = initial;
  const drafts = {
    findById: (id: string) => (content && id === 'd1' ? ({ id, content } as StoredDraft) : undefined),
  } as unknown as DraftRepository;
  const updateDraft = {
    execute: (_id: string, _hostId: string, next: DraftContent) => {
      if (next.name.trim() === '') return { ok: false, error: { code: 'NAME_REQUIRED', message: '' } };
      content = next;
      return { ok: true, draft: { content } as StoredDraft };
    },
  } as unknown as UpdateDraft;
  let seq = 0;
  const deps: ManageDraftParticipantsDeps = {
    // The real resolver over a stubbed search, so these tests keep exercising the
    // one name rule rather than a second copy of it stubbed out here.
    resolveContestByName: new ResolveContestByName({
      execute: () => matches,
    } as unknown as FindContestsByName),
    drafts,
    updateDraft,
    ids: { next: () => `new-${++seq}` },
  };
  return { deps, current: () => content };
}

const base = (participants: DraftContent['participants']): DraftContent => ({ name: 'Tapas Night', participants });

describe('AddDraftParticipant', () => {
  it('adds a participant to the resolved draft', () => {
    const { deps, current } = workspace(
      [summary('d1', 'Tapas Night', 'draft')],
      base([{ id: 'a', displayName: 'Ana' }, { id: 'b', displayName: 'Bob' }]),
    );
    const result = new AddDraftParticipant(deps).execute('h1', 'Tapas Night', 'Carmen');
    expect(result.details?.participants).toEqual(['Ana', 'Bob', 'Carmen']);
    expect(current()?.participants?.map((p) => p.displayName)).toEqual(['Ana', 'Bob', 'Carmen']);
  });

  it('offers candidates when two drafts share the name, and changes nothing', () => {
    const { deps, current } = workspace(
      [summary('d1', 'Tapas Night', 'draft'), summary('d2', 'Tapas Night', 'draft')],
      base([{ id: 'a', displayName: 'Ana' }]),
    );
    const result = new AddDraftParticipant(deps).execute('h1', 'Tapas Night', 'Carmen');
    expect(result.details).toBeUndefined();
    expect(result.candidates).toHaveLength(2);
    expect(current()?.participants).toHaveLength(1);
  });

  it('finds no draft to change when only a published contest has the name', () => {
    const { deps } = workspace([summary('c1', 'Tapas Night', 'live')]);
    const result = new AddDraftParticipant(deps).execute('h1', 'Tapas Night', 'Carmen');
    expect(result.details).toBeUndefined();
    expect(result.candidates).toEqual([]);
  });
});

describe('RemoveDraftParticipant', () => {
  it('removes a participant by name (case-insensitively)', () => {
    const { deps } = workspace(
      [summary('d1', 'Tapas Night', 'draft')],
      base([{ id: 'a', displayName: 'Ana' }, { id: 'b', displayName: 'Bob' }]),
    );
    const result = new RemoveDraftParticipant(deps).execute('h1', 'Tapas Night', 'bob');
    expect(result.details?.participants).toEqual(['Ana']);
  });

  it('clears a pairing that named the removed participant', () => {
    const { current, deps } = workspace(
      [summary('d1', 'Tapas Night', 'draft')],
      base([
        { id: 'a', displayName: 'Ana', partnerId: 'b' },
        { id: 'b', displayName: 'Bob', partnerId: 'a' },
      ]),
    );
    new RemoveDraftParticipant(deps).execute('h1', 'Tapas Night', 'Bob');
    const ana = current()?.participants?.find((p) => p.id === 'a');
    expect(ana?.partnerId).toBeUndefined();
  });

  it('changes nothing when no participant matches', () => {
    const { current, deps } = workspace(
      [summary('d1', 'Tapas Night', 'draft')],
      base([{ id: 'a', displayName: 'Ana' }]),
    );
    const result = new RemoveDraftParticipant(deps).execute('h1', 'Tapas Night', 'Nobody');
    expect(result.details?.participants).toEqual(['Ana']);
    expect(current()?.participants).toHaveLength(1);
  });
});
