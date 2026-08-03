import { describe, expect, it } from 'vitest';
import { CreateDraft, ListHostDrafts } from '../../../../src/index.js';
import { draftNamed, makeDraftDeps } from '../support.js';

describe('ListHostDrafts', async () => {
  it("lists only the requesting host's drafts", async () => {
    const { deps, drafts } = makeDraftDeps();
    await new CreateDraft(deps).execute('host-1', draftNamed('Mine'));
    await new CreateDraft(deps).execute('host-2', draftNamed('Theirs'));

    const hostOneDraftNames = (await new ListHostDrafts(drafts).execute('host-1')).map((draft) => draft.content.name);

    expect(hostOneDraftNames).toEqual(['Mine']);
  });
});
