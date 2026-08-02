import { describe, expect, it } from 'vitest';
import { asksAbout, fieldsAskedAbout } from '../../src/index.js';

/**
 * Every string here was produced by a real local model during the Slice F1/F2
 * smoke runs. The matcher is an approximation (see clarification-match.ts), so
 * it is pinned against real wording rather than wording invented to pass.
 */
describe('asksAbout', () => {
  it.each([
    ['No participants were listed yet for this draft.', 'participants'],
    ['We still don’t know who can participate in the contest.', 'participants'],
    ['I could not tell who is participating — please list them.', 'participants'],
    [
      'The role of attribution was not specified; we need to know if the judging score counts should be per person or per couple.',
      'format',
    ],
    [
      'We need detailed rules on how to score the tapas (what criteria are used and what is the scoring range?).',
      'scoring',
    ],
    ['We still need the official name of the contest.', 'name'],
    ['We need the process for revealing the winner at the end.', 'revealStrategy'],
    [
      'No specific closing rule for the contest was mentioned (e.g., elimination rounds).',
      'closeRule',
    ],
    [
      'We did not receive information about how contestants should be paired up or if there are any special anti-bias rules.',
      'format',
    ],
    [
      'What kind of contest is this — is everyone on their own, or do couples cook together?',
      'format',
    ],
  ] as const)('recognizes %j as asking about %s', (clarification, field) => {
    expect(asksAbout([clarification], field)).toBe(true);
  });

  it('does not credit a clarification about an unrelated field', () => {
    expect(asksAbout(['We still need the official name of the contest.'], 'participants')).toBe(
      false,
    );
  });

  it('searches across all clarifications, not just the first', () => {
    expect(
      asksAbout(['We still need the official name.', 'Who is participating?'], 'participants'),
    ).toBe(true);
  });

  it('finds nothing in an empty list', () => {
    expect(fieldsAskedAbout([])).toEqual([]);
  });

  it('reports every field a clarification set covers', () => {
    expect(
      fieldsAskedAbout(['Who is cooking?', 'How should dishes be scored?']).sort(),
    ).toEqual(['participants', 'scoring']);
  });
});
