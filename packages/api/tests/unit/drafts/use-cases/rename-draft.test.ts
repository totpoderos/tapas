import type { DraftContent } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { CreateDraft, RenameDraft } from '../../../../src/index.js';
import { draftNamed, makeDraftDeps } from '../support.js';

describe('RenameDraft', () => {
  it("renames the host's draft and records the previous and new name", () => {
    const { deps, auditLog } = makeDraftDeps();
    const savedDraft = new CreateDraft(deps).execute('host-1', draftNamed('Old name'));
    if (!savedDraft.ok) throw new Error('expected success');

    const renameResult = new RenameDraft(deps).execute(savedDraft.draft.id, 'host-1', 'New name');

    expect(renameResult.ok).toBe(true);
    const renameEvent = auditLog.findByContest(savedDraft.draft.id).find((entry) => entry.type === 'draft.updated');
    expect((renameEvent?.before as DraftContent).name).toBe('Old name');
    expect((renameEvent?.after as DraftContent).name).toBe('New name');
  });

  it('rejects renaming to an empty name', () => {
    const { deps } = makeDraftDeps();
    const savedDraft = new CreateDraft(deps).execute('host-1', draftNamed('Old name'));
    if (!savedDraft.ok) throw new Error('expected success');

    const renameResult = new RenameDraft(deps).execute(savedDraft.draft.id, 'host-1', '   ');

    expect(renameResult.ok).toBe(false);
    if (!renameResult.ok) expect(renameResult.error.code).toBe('NAME_REQUIRED');
  });

  it("refuses to rename another host's draft", () => {
    const { deps } = makeDraftDeps();
    const savedDraft = new CreateDraft(deps).execute('host-1', draftNamed('Mine'));
    if (!savedDraft.ok) throw new Error('expected success');

    const renameResult = new RenameDraft(deps).execute(savedDraft.draft.id, 'host-2', 'Hijacked');

    expect(renameResult.ok).toBe(false);
    if (!renameResult.ok) expect(renameResult.error.code).toBe('DRAFT_NOT_FOUND');
  });

  it('reports DRAFT_NOT_FOUND for an unknown draft', () => {
    const { deps } = makeDraftDeps();

    const renameResult = new RenameDraft(deps).execute('unknown', 'host-1', 'Whatever');

    expect(renameResult.ok).toBe(false);
    if (!renameResult.ok) expect(renameResult.error.code).toBe('DRAFT_NOT_FOUND');
  });
});
