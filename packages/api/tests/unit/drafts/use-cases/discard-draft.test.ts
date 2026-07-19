import { describe, expect, it } from 'vitest';
import { CreateDraft, DiscardDraft, ListHostDrafts } from '../../../../src/index.js';
import { draftNamed, makeDraftDeps } from '../support.js';

describe('DiscardDraft', () => {
  it("discards the host's draft and records draft.discarded", () => {
    const { deps, drafts, auditLog } = makeDraftDeps();
    const savedDraft = new CreateDraft(deps).execute('host-1', draftNamed('To discard'));
    if (!savedDraft.ok) throw new Error('expected success');

    const discardOutcome = new DiscardDraft(deps).execute(savedDraft.draft.id, 'host-1');

    expect(discardOutcome.ok).toBe(true);
    expect(new ListHostDrafts(drafts).execute('host-1')).toHaveLength(0);
    const wasDiscarded = auditLog.findByContest(savedDraft.draft.id).some((entry) => entry.type === 'draft.discarded');
    expect(wasDiscarded).toBe(true);
  });

  it("refuses to discard another host's draft", () => {
    const { deps } = makeDraftDeps();
    const savedDraft = new CreateDraft(deps).execute('host-1', draftNamed('Mine'));
    if (!savedDraft.ok) throw new Error('expected success');

    const discardOutcome = new DiscardDraft(deps).execute(savedDraft.draft.id, 'host-2');

    expect(discardOutcome.ok).toBe(false);
    if (!discardOutcome.ok) expect(discardOutcome.error.code).toBe('DRAFT_NOT_FOUND');
  });
});
