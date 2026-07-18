import { describe, expect, it } from 'vitest';
import { SYSTEM_ACTOR, type DomainEvent } from '../index.js';

describe('DomainEvent', () => {
  it('models a state change with a typed name and actor', () => {
    const event: DomainEvent<'draft.saved', { name: string }> = {
      type: 'draft.saved',
      contestId: 'contest-1',
      actorId: 'host-1',
      after: { name: 'Summer Tapas 2026' },
    };

    expect(event.type).toBe('draft.saved');
    expect(event.after?.name).toBe('Summer Tapas 2026');
  });

  it('exposes the system actor for system-triggered events', () => {
    expect(SYSTEM_ACTOR).toBe('system');
  });
});
