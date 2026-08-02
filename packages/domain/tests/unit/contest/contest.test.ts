import { describe, expect, it } from 'vitest';
import { Contest, type DraftContent } from '../../../src/index.js';

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

describe('Contest.publish', () => {
  it('publishes a complete draft into a live contest with the given join code', () => {
    const result = Contest.publish(
      { id: 'draft-1', hostId: 'host-1', content: completeContent('Summer') },
      'JOIN-1',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contest.status).toBe('live');
    expect(result.contest.name).toBe('Summer');
    expect(result.contest.joinCode).toBe('JOIN-1');
    expect(result.contest.materialized.dishes).toHaveLength(4);
  });

  it('defaults closeRule to all_sent and revealStrategy to host_trigger when unspecified', () => {
    const result = Contest.publish(
      { id: 'draft-1', hostId: 'host-1', content: completeContent('Summer') },
      'JOIN-1',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contest.closeRule).toEqual({ when: 'all_sent' });
    expect(result.contest.revealStrategy).toEqual({ when: 'host_trigger' });
  });

  it('carries through an explicit closeRule and revealStrategy', () => {
    const content: DraftContent = {
      ...completeContent('Summer'),
      closeRule: { when: 'scheduled', at: '2026-08-01T22:00:00.000Z' },
      revealStrategy: { when: 'scheduled', at: '2026-08-01T22:30:00.000Z' },
    };

    const result = Contest.publish({ id: 'draft-1', hostId: 'host-1', content }, 'JOIN-1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.contest.closeRule).toEqual({ when: 'scheduled', at: '2026-08-01T22:00:00.000Z' });
    expect(result.contest.revealStrategy).toEqual({
      when: 'scheduled',
      at: '2026-08-01T22:30:00.000Z',
    });
  });

  it('rejects a draft that has no scoring rules yet', () => {
    const result = Contest.publish(
      { id: 'draft-1', hostId: 'host-1', content: { name: 'Half-baked' } },
      'JOIN-1',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INCOMPLETE_DRAFT');
  });

  /*
   * All three used to be reported as "The draft is missing its scoring rules"
   * whichever was actually absent. A contest prepared through the assistant
   * arrives with its people and its scoring settled and no format, and its host
   * was sent to fix the scoring, which was complete.
   */
  it('names the format when that is the only thing the draft never said', () => {
    const noFormat: DraftContent = {
      name: 'Tapas Night',
      participants: [
        { id: 'a', displayName: 'Ana' },
        { id: 'b', displayName: 'Bob' },
      ],
      scoring: {
        categories: [{ id: 'c1', name: 'Taste' }],
        range: { type: 'fixed', min: 1, max: 5 },
        uniquePerCategory: false,
      },
    };
    const result = Contest.publish({ id: 'd1', hostId: 'h1', content: noFormat }, 'JOIN-1');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INCOMPLETE_DRAFT');
    expect(result.error.message).toContain('what kind of contest it is');
    // The thing it must NOT say, because the scoring is right there.
    expect(result.error.message).not.toContain('how it is scored');
  });

  it('names the people when nobody was ever listed', () => {
    const noPeople: DraftContent = {
      name: 'Tapas Night',
      format: 'solo',
      scoring: {
        categories: [{ id: 'c1', name: 'Taste' }],
        range: { type: 'auto' },
        uniquePerCategory: false,
      },
    };
    const result = Contest.publish({ id: 'd1', hostId: 'h1', content: noPeople }, 'JOIN-1');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('who is taking part');
    expect(result.error.message).not.toContain('what kind of contest it is');
  });

  it('names all three when a draft has only a name', () => {
    const result = Contest.publish(
      { id: 'd1', hostId: 'h1', content: { name: 'Half-baked' } },
      'JOIN-1',
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain('what kind of contest it is');
    expect(result.error.message).toContain('who is taking part');
    expect(result.error.message).toContain('how it is scored');
  });

  it('surfaces a compiler rejection (a judge who could score nothing)', () => {
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

    const result = Contest.publish(
      { id: 'draft-1', hostId: 'host-1', content: singleCouple },
      'JOIN-1',
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
  });
});
