import type { DraftContent } from '@tapas/domain';
import { describe, expect, it } from 'vitest';
import { CreateDraft } from '../../../../src/index.js';
import { draftNamed, makeDraftDeps } from '../support.js';

describe('CreateDraft', async () => {
  it('saves a draft and records draft.saved by the host via the form path', async () => {
    const { deps, auditLog } = makeDraftDeps();

    const creation = await new CreateDraft(deps).execute('host-1', draftNamed('Summer Tapas'));

    expect(creation.ok).toBe(true);
    if (!creation.ok) return;
    const savedEvent = (await auditLog.findByContest(creation.draft.id)).find((entry) => entry.type === 'draft.saved');
    expect(savedEvent?.actorId).toBe('host-1');
    expect(savedEvent?.sourcePath).toBe('form');
    expect((savedEvent?.after as DraftContent).name).toBe('Summer Tapas');
  });

  it('rejects a nameless draft and stores nothing', async () => {
    const { deps, drafts, auditLog } = makeDraftDeps();

    const creation = await new CreateDraft(deps).execute('host-1', draftNamed('   '));

    expect(creation.ok).toBe(false);
    if (!creation.ok) expect(creation.error.code).toBe('NAME_REQUIRED');
    expect(await drafts.findByHost('host-1')).toHaveLength(0);
    expect(auditLog.entries).toHaveLength(0);
  });

  it('records how the action arrived, and what asked for it', async () => {
    const { deps, auditLog } = makeDraftDeps();

    const creation = await new CreateDraft(deps).execute('host-1', draftNamed('Via chat'), {
      sourcePath: 'mcp',
      toolName: 'create_draft',
      toolArgs: { name: 'Via chat' },
    });

    if (!creation.ok) throw new Error('expected success');
    const entry = (await auditLog.findByContest(creation.draft.id))[0];
    expect(entry?.sourcePath).toBe('mcp');
    expect(entry?.toolName).toBe('create_draft');
    expect(entry?.toolArgs).toMatchObject({ name: 'Via chat' });
  });

  /*
   * A category's id is internal identity, not something a host states — the same
   * as a participant's. A model asked for "judged on Taste and Originality" has
   * no id to give, and the host has never been shown one, so the API assigns it
   * here rather than leaving the caller to invent one.
   */
  it('gives a category with no id one of its own', async () => {
    const { deps } = makeDraftDeps();

    const creation = await new CreateDraft(deps).execute('host-1', {
      name: 'Tapas',
      participants: [],
      scoring: {
        categories: [{ name: 'Taste' }, { name: 'Originality' }] as never,
        range: { type: 'auto' },
        uniquePerCategory: false,
      },
    });

    if (!creation.ok) throw new Error('expected success');
    const categories = creation.draft.content.scoring?.categories ?? [];
    expect(categories.map((category) => category.name)).toEqual(['Taste', 'Originality']);
    for (const category of categories) expect(category.id).toBeTruthy();
    expect(new Set(categories.map((category) => category.id)).size).toBe(2);
  });

  it('leaves a category that already has an id alone', async () => {
    const { deps } = makeDraftDeps();

    const creation = await new CreateDraft(deps).execute('host-1', {
      name: 'Tapas',
      participants: [],
      scoring: {
        categories: [{ id: 'kept', name: 'Taste' }, { name: 'Originality' }] as never,
        range: { type: 'auto' },
        uniquePerCategory: false,
      },
    });

    if (!creation.ok) throw new Error('expected success');
    const categories = creation.draft.content.scoring?.categories ?? [];
    expect(categories[0]?.id).toBe('kept');
    expect(categories[1]?.id).toBeTruthy();
    expect(categories[1]?.id).not.toBe('kept');
  });

  it('records an unmarked call as the app', async () => {
    // The default matters: a direct call is a host working in the app.
    const { deps, auditLog } = makeDraftDeps();

    const creation = await new CreateDraft(deps).execute('host-1', draftNamed('By hand'));

    if (!creation.ok) throw new Error('expected success');
    expect((await auditLog.findByContest(creation.draft.id))[0]?.sourcePath).toBe('form');
  });
});
