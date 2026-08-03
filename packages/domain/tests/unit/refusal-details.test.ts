import { describe, expect, it } from 'vitest';
import { Contest, compile, type CompileResult, type ContestDraft, type Person } from '../../src/index.js';

/**
 * Every refusal carries the facts its sentence names.
 *
 * A sentence is written in one language and cannot be put into another by
 * whoever reads it, so the panel that has to say this in Spanish needs the
 * people and the categories as values rather than as words already glued into
 * English. The message stays for readers with no words of their own.
 *
 * The two refusals that name nothing are here too: carrying no details is a
 * decision about them, and a test is where a decision like that stops looking
 * like an omission.
 */

function person(id: string, partnerId?: string, displayName?: string): Person {
  return { id, displayName: displayName ?? id, ...(partnerId ? { partnerId } : {}) };
}

function makeDraft(over: Partial<ContestDraft> & { participants: Person[] }): ContestDraft {
  return {
    format: 'solo',
    scoring: { categories: [{ id: 'c1', name: 'Taste' }], range: { type: 'auto' }, uniquePerCategory: false },
    ...over,
  };
}

function refusal(result: CompileResult): { code: string; message: string; details?: Record<string, unknown> } {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('expected a refusal');
  return result.error as unknown as { code: string; message: string; details?: Record<string, unknown> };
}

const scoredOn = (categories: { id: string; name: string }[]) => ({
  categories,
  range: { type: 'auto' } as const,
  uniquePerCategory: false,
});

describe('a refusal carries the facts it is about', () => {
  it('names the person who has no partner in a couples contest', () => {
    const error = refusal(
      compile(
        makeDraft({
          format: 'couples',
          participants: [person('a', 'b', 'Ana'), person('b', 'a', 'Bruno'), person('c', undefined, 'Carla')],
        }),
      ),
    );

    expect(error.code).toBe('UNPARTNERED_IN_COUPLES');
    expect(error.details).toEqual({ person: 'Carla' });
    expect(error.message).toContain('Carla');
  });

  it('names the person whose partner is not taking part', () => {
    const error = refusal(compile(makeDraft({ participants: [person('a', 'zz', 'Ana'), person('b', undefined, 'Bruno')] })));

    expect(error.code).toBe('MISSING_PARTNER');
    expect(error.details).toEqual({ person: 'Ana' });
  });

  it('names the person whose partnership is one-sided', () => {
    const error = refusal(
      compile(
        makeDraft({
          participants: [person('a', 'b', 'Ana'), person('b', 'c', 'Bruno'), person('c', 'b', 'Carla')],
        }),
      ),
    );

    expect(error.code).toBe('INCONSISTENT_PARTNER');
    expect(error.details).toEqual({ person: 'Ana' });
  });

  it('names the person who could score nothing', () => {
    const error = refusal(
      compile(
        makeDraft({
          format: 'solo_with_partners',
          participants: [person('a', 'b', 'Ana'), person('b', 'a', 'Bruno')],
        }),
      ),
    );

    expect(error.code).toBe('JUDGE_CANNOT_SCORE_ANY_DISH');
    expect(error.details).toEqual({ person: 'Ana' });
  });

  /*
   * The sibling of the category refusal, which was deliberately written to name
   * the two categories rather than the id they share. This one quoted the id —
   * something the host has never been shown and cannot look for.
   */
  it('names the two people who cannot be told apart, and quotes no id', () => {
    // An id that spells nothing, so "the message does not contain it" cannot pass
    // or fail by accident on an ordinary English word.
    const error = refusal(
      compile(makeDraft({ participants: [person('p3f7a', undefined, 'Ana'), person('p3f7a', undefined, 'Bruno')] })),
    );

    expect(error.code).toBe('DUPLICATE_PERSON_ID');
    expect(error.details).toEqual({ first: 'Ana', second: 'Bruno' });
    expect(error.message).toContain('Ana');
    expect(error.message).toContain('Bruno');
    expect(error.message).not.toContain('p3f7a');
  });

  it('names the two things judged on that cannot be told apart', () => {
    const error = refusal(
      compile(
        makeDraft({
          participants: [person('a'), person('b')],
          scoring: scoredOn([
            { id: 'c1', name: 'Taste' },
            { id: 'c1', name: 'Originality' },
          ]),
        }),
      ),
    );

    expect(error.code).toBe('DUPLICATE_CATEGORY_ID');
    expect(error.details).toEqual({ first: 'Taste', second: 'Originality' });
  });

  it('gives the bounds of a range it will not accept', () => {
    const error = refusal(
      compile(
        makeDraft({
          participants: [person('a'), person('b')],
          scoring: {
            categories: [{ id: 'c1', name: 'Taste' }],
            range: { type: 'fixed', min: 10, max: 1 },
            uniquePerCategory: false,
          },
        }),
      ),
    );

    expect(error.code).toBe('INVALID_RANGE');
    expect(error.details).toEqual({ min: 10, max: 1 });
  });

  it('is about nobody in particular when there is nobody taking part', () => {
    const error = refusal(compile(makeDraft({ participants: [] })));

    expect(error.code).toBe('NO_PARTICIPANTS');
    expect(error.details).toBeUndefined();
  });

  it('is about nothing in particular when there is nothing to judge on', () => {
    const error = refusal(compile(makeDraft({ participants: [person('a'), person('b')], scoring: scoredOn([]) })));

    expect(error.code).toBe('NO_CATEGORIES');
    expect(error.details).toBeUndefined();
  });

  /*
   * The gaps themselves, not the phrases the English sentence joins them into: a
   * reader with its own words has its own way of listing things and its own word
   * for "or".
   */
  it('says which things a draft has still not said', () => {
    const published = Contest.publish({ id: 'd1', hostId: 'h1', content: { name: 'Half-baked' } }, 'JOIN01');

    expect(published.ok).toBe(false);
    if (published.ok) return;
    expect(published.error.code).toBe('INCOMPLETE_DRAFT');
    expect(published.error.details).toEqual({ unsaid: ['format', 'participants', 'scoring'] });
    expect(published.error.message).toContain('what kind of contest it is');
  });

  it('says only the things actually unsaid', () => {
    const published = Contest.publish(
      {
        id: 'd1',
        hostId: 'h1',
        content: {
          name: 'Nearly',
          participants: [{ id: 'a', displayName: 'Ana' }],
          scoring: scoredOn([{ id: 'c1', name: 'Taste' }]),
        },
      },
      'JOIN01',
    );

    expect(published.ok).toBe(false);
    if (published.ok) return;
    expect(published.error.details).toEqual({ unsaid: ['format'] });
  });
});
