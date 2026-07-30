import type { DraftContent } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { PublishContest } from '../../../../src/index.js';
import { FakeDraftRepository } from '../../drafts/support.js';
import { makePublishDeps } from '../support.js';

function person(id: string, partnerId: string) {
  return { id, displayName: id, partnerId };
}

function completeContent(name: string): DraftContent {
  return {
    name,
    attribution: 'per_person',
    antiBias: 'couples',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

function seedDraft(
  drafts: FakeDraftRepository,
  id: string,
  hostId: string,
  content: DraftContent,
): void {
  drafts.insert({ id, hostId, content, status: 'draft', createdAt: 'seed', updatedAt: 'seed' });
}

describe('PublishContest', () => {
  it('publishes a complete draft: live contest, join code, draft retired, contest.published recorded', () => {
    const { deps, drafts, contests, auditLog } = makePublishDeps();
    seedDraft(drafts, 'draft-1', 'host-1', completeContent('Summer'));

    const publishOutcome = new PublishContest(deps).execute('draft-1', 'host-1');

    expect(publishOutcome.ok).toBe(true);
    if (!publishOutcome.ok) return;
    expect(publishOutcome.contest.status).toBe('live');
    expect(publishOutcome.contest.joinCode).toBe('JOIN-1');
    expect(contests.findById('draft-1')).toBeDefined();
    expect(drafts.findById('draft-1')).toBeUndefined();
    expect(
      auditLog.findByContest('draft-1').some((entry) => entry.type === 'contest.published'),
    ).toBe(true);
  });

  /*
   * The compiler consumes both of these and emits their consequence: dishes with
   * one submitter or two, and a set of dishes each judge may score. Neither is
   * recoverable afterwards — barring couples and barring chosen pairs compile to
   * the same shape — and the draft that held them is retired at publish. So the
   * contest has to keep them, or the host can never be told what their own live
   * contest is being played by.
   */
  it('keeps the rules the compiler consumes, so the contest can still say them', () => {
    const { deps, drafts, contests } = makePublishDeps();
    seedDraft(drafts, 'draft-1', 'host-1', completeContent('Summer'));

    new PublishContest(deps).execute('draft-1', 'host-1');

    const stored = contests.findById('draft-1');
    expect(stored?.attribution).toBe('per_person');
    expect(stored?.antiBias).toBe('couples');
  });

  it('seeds the roster with an open place per participant', () => {
    const { deps, drafts, roster } = makePublishDeps();
    seedDraft(drafts, 'draft-1', 'host-1', completeContent('Summer'));

    new PublishContest(deps).execute('draft-1', 'host-1');

    const places = roster.listAvailable('draft-1');
    expect(places.map((place) => place.participantId).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('reports DRAFT_NOT_FOUND for an unknown draft', () => {
    const { deps } = makePublishDeps();

    const publishOutcome = new PublishContest(deps).execute('unknown', 'host-1');

    expect(publishOutcome.ok).toBe(false);
    if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('DRAFT_NOT_FOUND');
  });

  it("refuses to publish another host's draft", () => {
    const { deps, drafts } = makePublishDeps();
    seedDraft(drafts, 'draft-1', 'host-1', completeContent('Mine'));

    const publishOutcome = new PublishContest(deps).execute('draft-1', 'host-2');

    expect(publishOutcome.ok).toBe(false);
    if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('DRAFT_NOT_FOUND');
  });

  it('rejects an incomplete draft and creates no contest', () => {
    const { deps, drafts, contests } = makePublishDeps();
    seedDraft(drafts, 'draft-1', 'host-1', { name: 'Half-baked' });

    const publishOutcome = new PublishContest(deps).execute('draft-1', 'host-1');

    expect(publishOutcome.ok).toBe(false);
    if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('INCOMPLETE_DRAFT');
    expect(contests.findById('draft-1')).toBeUndefined();
    expect(drafts.findById('draft-1')).toBeDefined(); // not retired
  });

  it('surfaces the compiler rejection when a judge could score nothing', () => {
    const { deps, drafts } = makePublishDeps();
    const singleCouple: DraftContent = {
      name: 'Just us',
      attribution: 'per_person',
      antiBias: 'couples',
      scoring: {
        categories: [{ id: 'c1', name: 'Taste' }],
        range: { type: 'auto' },
        uniquePerCategory: true,
      },
      participants: [person('A', 'B'), person('B', 'A')],
    };
    seedDraft(drafts, 'draft-1', 'host-1', singleCouple);

    const publishOutcome = new PublishContest(deps).execute('draft-1', 'host-1');

    expect(publishOutcome.ok).toBe(false);
    if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
  });
});
