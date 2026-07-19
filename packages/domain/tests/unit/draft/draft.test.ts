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
});
