import { describe, expect, it } from 'vitest';
import { CreateDraft, ListHostDrafts } from '../../../../src/index.js';
import { draftNamed, makeDraftDeps } from '../support.js';

describe('ListHostDrafts', () => {
  it("lists only the requesting host's drafts", () => {
    const { deps, drafts } = makeDraftDeps();
    new CreateDraft(deps).execute('host-1', draftNamed('Mine'));
    new CreateDraft(deps).execute('host-2', draftNamed('Theirs'));

    const hostOneDraftNames = new ListHostDrafts(drafts).execute('host-1').map((draft) => draft.content.name);

    expect(hostOneDraftNames).toEqual(['Mine']);
  });
});
