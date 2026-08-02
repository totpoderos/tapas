import { describe, expect, it } from 'vitest';
import { Draft } from '../../../src/index.js';

describe('Draft', () => {
  it('is created when it has a name', () => {
    const creation = Draft.create('draft-1', 'host-1', { name: 'Summer Tapas 2026' });
    expect(creation.ok).toBe(true);
    if (creation.ok) expect(creation.draft.content.name).toBe('Summer Tapas 2026');
  });

  it('cannot be created without a name', () => {
    const creation = Draft.create('draft-1', 'host-1', { name: '   ' });
    expect(creation.ok).toBe(false);
    if (!creation.ok) expect(creation.error.code).toBe('NAME_REQUIRED');
  });

  it('renames to a new name', () => {
    const draft = Draft.rehydrate('draft-1', 'host-1', { name: 'Old name' });
    const renamed = draft.rename('New name');
    expect(renamed.ok).toBe(true);
    if (renamed.ok) expect(renamed.draft.content.name).toBe('New name');
  });

  it('refuses to rename to an empty name', () => {
    const draft = Draft.rehydrate('draft-1', 'host-1', { name: 'Old name' });
    const renamed = draft.rename('');
    expect(renamed.ok).toBe(false);
    if (!renamed.ok) expect(renamed.error.code).toBe('NAME_REQUIRED');
  });

  it('does not mutate the original when renamed', () => {
    const draft = Draft.rehydrate('draft-1', 'host-1', { name: 'Old name' });
    draft.rename('New name');
    expect(draft.content.name).toBe('Old name');
  });

  it('replaces the whole content when edited, keeping the id and host', () => {
    const draft = Draft.rehydrate('draft-1', 'host-1', { name: 'Old name' });
    const edited = draft.withContent({
      name: 'New name',
      format: 'couples',
      participants: [{ id: 'a', displayName: 'Ana', partnerId: 'b' }],
    });
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.draft.id).toBe('draft-1');
      expect(edited.draft.hostId).toBe('host-1');
      expect(edited.draft.content.format).toBe('couples');
      expect(edited.draft.content.participants).toEqual([{ id: 'a', displayName: 'Ana', partnerId: 'b' }]);
    }
  });

  it('refuses to edit to an empty name (the one invariant a draft keeps)', () => {
    const draft = Draft.rehydrate('draft-1', 'host-1', { name: 'Old name' });
    const edited = draft.withContent({ name: '  ', format: 'solo' });
    expect(edited.ok).toBe(false);
    if (!edited.ok) expect(edited.error.code).toBe('NAME_REQUIRED');
  });

  it('does not mutate the original when edited', () => {
    const draft = Draft.rehydrate('draft-1', 'host-1', { name: 'Old name', format: 'solo' });
    draft.withContent({ name: 'New name', format: 'couples' });
    expect(draft.content.name).toBe('Old name');
    expect(draft.content.format).toBe('solo');
  });
});
