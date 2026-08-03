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
    format: 'solo_with_partners',
    scoring: {
      categories: [{ id: 'c1', name: 'Taste' }],
      range: { type: 'auto' },
      uniquePerCategory: true,
    },
    participants: [person('A', 'B'), person('B', 'A'), person('C', 'D'), person('D', 'C')],
  };
}

async function seedDraft(
  drafts: FakeDraftRepository,
  id: string,
  hostId: string,
  content: DraftContent,
): Promise<void> {
  await drafts.insert({ id, hostId, content, status: 'draft', createdAt: 'seed', updatedAt: 'seed' });
}

describe('PublishContest', async () => {
  it('publishes a complete draft: live contest, join code, draft retired, contest.published recorded', async () => {
    const { deps, drafts, contests, auditLog } = makePublishDeps();
    await seedDraft(drafts, 'draft-1', 'host-1', completeContent('Summer'));

    const publishOutcome = await new PublishContest(deps).execute('draft-1', 'host-1');

    expect(publishOutcome.ok).toBe(true);
    if (!publishOutcome.ok) return;
    expect(publishOutcome.contest.status).toBe('live');
    expect(publishOutcome.contest.joinCode).toBe('JOIN-1');
    expect(await contests.findById('draft-1')).toBeDefined();
    expect(await drafts.findById('draft-1')).toBeUndefined();
    expect(
      (await auditLog.findByContest('draft-1')).some((entry) => entry.type === 'contest.published'),
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
  it('keeps the rules the compiler consumes, so the contest can still say them', async () => {
    const { deps, drafts, contests } = makePublishDeps();
    await seedDraft(drafts, 'draft-1', 'host-1', completeContent('Summer'));

    await new PublishContest(deps).execute('draft-1', 'host-1');

    const stored = await contests.findById('draft-1');
    expect(stored?.format).toBe('solo_with_partners');
  });

  it('seeds the roster with an open place per participant', async () => {
    const { deps, drafts, roster } = makePublishDeps();
    await seedDraft(drafts, 'draft-1', 'host-1', completeContent('Summer'));

    await new PublishContest(deps).execute('draft-1', 'host-1');

    const places = await roster.listAvailable('draft-1');
    expect(places.map((place) => place.participantId).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('reports DRAFT_NOT_FOUND for an unknown draft', async () => {
    const { deps } = makePublishDeps();

    const publishOutcome = await new PublishContest(deps).execute('unknown', 'host-1');

    expect(publishOutcome.ok).toBe(false);
    if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('DRAFT_NOT_FOUND');
  });

  it("refuses to publish another host's draft", async () => {
    const { deps, drafts } = makePublishDeps();
    await seedDraft(drafts, 'draft-1', 'host-1', completeContent('Mine'));

    const publishOutcome = await new PublishContest(deps).execute('draft-1', 'host-2');

    expect(publishOutcome.ok).toBe(false);
    if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('DRAFT_NOT_FOUND');
  });

  it('rejects an incomplete draft and creates no contest', async () => {
    const { deps, drafts, contests } = makePublishDeps();
    await seedDraft(drafts, 'draft-1', 'host-1', { name: 'Half-baked' });

    const publishOutcome = await new PublishContest(deps).execute('draft-1', 'host-1');

    expect(publishOutcome.ok).toBe(false);
    if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('INCOMPLETE_DRAFT');
    expect(await contests.findById('draft-1')).toBeUndefined();
    expect(await drafts.findById('draft-1')).toBeDefined(); // not retired
  });

  it('surfaces the compiler rejection when a judge could score nothing', async () => {
    const { deps, drafts } = makePublishDeps();
    const singleCouple: DraftContent = {
      name: 'Just us',
      format: 'solo_with_partners',
      scoring: {
        categories: [{ id: 'c1', name: 'Taste' }],
        range: { type: 'auto' },
        uniquePerCategory: true,
      },
      participants: [person('A', 'B'), person('B', 'A')],
    };
    await seedDraft(drafts, 'draft-1', 'host-1', singleCouple);

    const publishOutcome = await new PublishContest(deps).execute('draft-1', 'host-1');

    expect(publishOutcome.ok).toBe(false);
    if (!publishOutcome.ok) expect(publishOutcome.error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
  });
});
