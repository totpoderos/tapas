import { describe, expect, it } from 'vitest';
import type { DraftContent } from '@tapas/domain';
import type { ContestSummary } from '../../../src/contests/contest-summary.js';
import type { FindContestsByName } from '../../../src/contests/use-cases/find-contests-by-name.js';
import { ResolveContestByName } from '../../../src/contests/use-cases/resolve-contest-by-name.js';
import type { DraftRepository } from '../../../src/db/draft-repository.js';
import type { StoredDraft } from '../../../src/drafts/stored-draft.js';
import type { UpdateDraft } from '../../../src/drafts/use-cases/update-draft.js';
import {
  AddScoringCategory,
  RemoveScoringCategory,
  SetScoreRange,
  SetScoreUniqueness,
  type ShapeDraftScoringDeps,
} from '../../../src/drafts/use-cases/shape-draft-scoring.js';

const summary = (id: string, name: string, status: ContestSummary['status'] = 'draft'): ContestSummary => ({
  id,
  name,
  status,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

/** A workspace where one draft's content is held in memory and mutated by UpdateDraft. */
function workspace(matches: ContestSummary[], initial?: DraftContent) {
  let content = initial;
  const drafts = {
    findById: (id: string) => (content && id === 'd1' ? ({ id, content } as StoredDraft) : undefined),
  } as unknown as DraftRepository;
  const updateDraft = {
    execute: (_id: string, _hostId: string, next: DraftContent) => {
      content = next;
      return { ok: true, draft: { content } as StoredDraft };
    },
  } as unknown as UpdateDraft;
  let seq = 0;
  const deps: ShapeDraftScoringDeps = {
    // The real resolver over a stubbed search, so these exercise the one name
    // rule rather than a second copy of it stubbed out here.
    resolveContestByName: new ResolveContestByName({
      execute: () => matches,
    } as unknown as FindContestsByName),
    drafts,
    updateDraft,
    ids: { next: () => `cat-${++seq}` },
  };
  return { deps, current: () => content };
}

const scored = (categories: string[], extra: Partial<DraftContent> = {}): DraftContent => ({
  name: 'Tapas Night',
  scoring: {
    categories: categories.map((name, i) => ({ id: `c${i}`, name })),
    range: { type: 'fixed', min: 1, max: 10 },
    uniquePerCategory: false,
  },
  ...extra,
});

const categoriesOf = (content: DraftContent | undefined) =>
  (content?.scoring?.categories ?? []).map((c) => c.name);

describe('AddScoringCategory', () => {
  it('adds something for the draft to be judged on', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    const answer = new AddScoringCategory(deps).execute('h1', 'Tapas Night', 'Presentation');

    expect(answer.ok).toBe(true);
    expect(categoriesOf(current())).toEqual(['Taste', 'Presentation']);
  });

  it('gives the new category an id of its own', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    new AddScoringCategory(deps).execute('h1', 'Tapas Night', 'Presentation');

    const ids = (current()?.scoring?.categories ?? []).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every(Boolean)).toBe(true);
  });

  /*
   * A category is addressed by name, so two of the same name would leave the
   * host unable to say which to remove. The form can allow it because it removes
   * by the row it drew; a conversation has only the name.
   */
  it('refuses a name the draft is already judged on, and changes nothing', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    const answer = new AddScoringCategory(deps).execute('h1', 'Tapas Night', 'Taste');

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.error.code).toBe('ALREADY_JUDGED_ON');
    expect(answer.error.message).toContain('Taste');
    expect(categoriesOf(current())).toEqual(['Taste']);
  });

  it('treats a name that differs only by case or spacing as the same one', () => {
    const { deps } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    expect(new AddScoringCategory(deps).execute('h1', 'Tapas Night', '  taste ').ok).toBe(false);
  });

  it('settles the first category on a draft with no scoring at all', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], { name: 'Tapas Night' });
    const answer = new AddScoringCategory(deps).execute('h1', 'Tapas Night', 'Taste');

    expect(answer.ok).toBe(true);
    expect(categoriesOf(current())).toEqual(['Taste']);
  });

  it('offers the candidates when the name is not one draft', () => {
    const both = [summary('d1', 'Tapas Night'), summary('d2', 'Tapas Night')];
    const { deps } = workspace(both, scored(['Taste']));
    const answer = new AddScoringCategory(deps).execute('h1', 'Tapas Night', 'Presentation');

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.result.candidates).toHaveLength(2);
    expect(answer.result.details).toBeUndefined();
  });

  it('changes nothing for a name only a published contest has', () => {
    const { deps, current } = workspace([summary('c1', 'Tapas Night', 'live')], scored(['Taste']));
    const answer = new AddScoringCategory(deps).execute('h1', 'Tapas Night', 'Presentation');

    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    expect(answer.result.candidates).toEqual([]);
    expect(categoriesOf(current())).toEqual(['Taste']);
  });
});

describe('RemoveScoringCategory', () => {
  it('stops the draft being judged on it', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste', 'Presentation']));
    const answer = new RemoveScoringCategory(deps).execute('h1', 'Tapas Night', 'Presentation');

    expect(answer.ok).toBe(true);
    expect(categoriesOf(current())).toEqual(['Taste']);
  });

  /*
   * Not a silent no-op: the host has just confirmed a removal, and reporting
   * "done" over an unchanged draft is the worst of both answers.
   */
  it('refuses when the draft is not judged on it', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    const answer = new RemoveScoringCategory(deps).execute('h1', 'Tapas Night', 'Presentation');

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.error.code).toBe('NOT_JUDGED_ON');
    expect(categoriesOf(current())).toEqual(['Taste']);
  });

  it('leaves the range and the uniqueness choice as they were', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste', 'Presentation']));
    new RemoveScoringCategory(deps).execute('h1', 'Tapas Night', 'Presentation');

    expect(current()?.scoring?.range).toEqual({ type: 'fixed', min: 1, max: 10 });
    expect(current()?.scoring?.uniquePerCategory).toBe(false);
  });
});

describe('SetScoreRange', () => {
  it('sets an explicit range', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    new SetScoreRange(deps).execute('h1', 'Tapas Night', { type: 'fixed', min: 1, max: 5 });

    expect(current()?.scoring?.range).toEqual({ type: 'fixed', min: 1, max: 5 });
  });

  it('lets the range be worked out from the contest', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    new SetScoreRange(deps).execute('h1', 'Tapas Night', { type: 'auto' });

    expect(current()?.scoring?.range).toEqual({ type: 'auto' });
  });

  /*
   * Deliberate. Two good numbers in the right shape, wrong only against the
   * whole contest — which is what publishing checks, for the form and for the
   * assistant alike. Refusing here would be a validator the form does not share.
   */
  it('keeps a range whose bounds make no range, for publishing to refuse', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    const answer = new SetScoreRange(deps).execute('h1', 'Tapas Night', { type: 'fixed', min: 5, max: 2 });

    expect(answer.ok).toBe(true);
    expect(current()?.scoring?.range).toEqual({ type: 'fixed', min: 5, max: 2 });
  });

  it('leaves what the draft is judged on alone', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste', 'Presentation']));
    new SetScoreRange(deps).execute('h1', 'Tapas Night', { type: 'auto' });

    expect(categoriesOf(current())).toEqual(['Taste', 'Presentation']);
  });
});

describe('SetScoreUniqueness', () => {
  it('requires a different score for each dish in a category', () => {
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], scored(['Taste']));
    new SetScoreUniqueness(deps).execute('h1', 'Tapas Night', true);

    expect(current()?.scoring?.uniquePerCategory).toBe(true);
  });

  it('lets a score be used more than once again', () => {
    const initial = scored(['Taste']);
    const { deps, current } = workspace([summary('d1', 'Tapas Night')], {
      ...initial,
      scoring: { ...initial.scoring!, uniquePerCategory: true },
    });
    new SetScoreUniqueness(deps).execute('h1', 'Tapas Night', false);

    expect(current()?.scoring?.uniquePerCategory).toBe(false);
  });

  /* The rule the whole way of working rests on: one asking changes one thing. */
  it('leaves the people and the rest of the scoring alone', () => {
    const { deps, current } = workspace(
      [summary('d1', 'Tapas Night')],
      scored(['Taste'], { participants: [{ id: 'a', displayName: 'Ana' }, { id: 'b', displayName: 'Bob' }] }),
    );
    new SetScoreUniqueness(deps).execute('h1', 'Tapas Night', true);

    expect((current()?.participants ?? []).map((p) => p.displayName)).toEqual(['Ana', 'Bob']);
    expect(categoriesOf(current())).toEqual(['Taste']);
    expect(current()?.scoring?.range).toEqual({ type: 'fixed', min: 1, max: 10 });
  });
});
