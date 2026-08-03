import { describe, expect, it } from 'vitest';
import { CreateDraft, GetDraft } from '../../../../src/index.js';
import { draftNamed, makeDraftDeps } from '../support.js';

describe('GetDraft', async () => {
  it("returns the host's own draft", async () => {
    const { deps, drafts } = makeDraftDeps();
    const savedDraft = await new CreateDraft(deps).execute('host-1', draftNamed('Mine'));
    if (!savedDraft.ok) throw new Error('expected success');

    const found = await new GetDraft(drafts).execute(savedDraft.draft.id, 'host-1');

    expect(found?.content.name).toBe('Mine');
  });

  it("hides another host's draft (ownership, A01)", async () => {
    const { deps, drafts } = makeDraftDeps();
    const savedDraft = await new CreateDraft(deps).execute('host-1', draftNamed('Mine'));
    if (!savedDraft.ok) throw new Error('expected success');

    const found = await new GetDraft(drafts).execute(savedDraft.draft.id, 'host-2');

    expect(found).toBeUndefined();
  });
});
