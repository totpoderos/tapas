import type { EvalCase } from '../../src/case.js';

/**
 * Partial + clarify cases (4) — the two-phase chat (design.md §8), which is
 * what Slice F2 made real. Each case is genuinely multi-turn: turn 1 leaves a
 * gap the assistant must notice and ask about, turn 2 answers it. What is
 * measured is not just "did it get the answer" but the merge contract: the
 * reply's fields win, everything already settled survives, and clarifications
 * shrink as they are answered.
 */
export const PARTIAL_CLARIFY_CASES: EvalCase[] = [
  {
    id: 'partial-participants-then-named',
    category: 'partial_clarify',
    note: 'Participants missing, then supplied. The name must survive a turn that never mentions it.',
    turns: [
      {
        message: 'I want to run a contest called Winter Tapas, judged on taste from 1 to 5, repeats allowed.',
        expect: {
          fields: {
            name: 'Winter Tapas',
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'fixed', min: 1, max: 5 },
              uniquePerCategory: false,
            },
          },
          clarifiesAbout: ['participants', 'attribution'],
          absent: [],
        },
      },
      {
        message: 'Ana (id ana) and Bob (id bob) are cooking, and each dish belongs to whoever cooked it.',
        expect: {
          fields: {
            name: 'Winter Tapas',
            attribution: 'per_person',
            participants: [
              { id: 'ana', displayName: 'Ana' },
              { id: 'bob', displayName: 'Bob' },
            ],
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'fixed', min: 1, max: 5 },
              uniquePerCategory: false,
            },
          },
          clarifiesAbout: [],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'partial-scoring-then-specified',
    category: 'partial_clarify',
    note: 'Scoring missing, then supplied in full. Participants extracted in turn 1 must survive turn 2.',
    turns: [
      {
        message: 'A contest called Spring Tapas. Ana (id ana), Bob (id bob) and Carla (id carla) are cooking.',
        expect: {
          fields: {
            name: 'Spring Tapas',
            participants: [
              { id: 'ana', displayName: 'Ana' },
              { id: 'bob', displayName: 'Bob' },
              { id: 'carla', displayName: 'Carla' },
            ],
          },
          clarifiesAbout: ['scoring', 'attribution'],
          absent: [],
        },
      },
      {
        message: 'Judge on presentation and taste, 1 to 10 each, and the same score can repeat.',
        expect: {
          fields: {
            name: 'Spring Tapas',
            participants: [
              { id: 'ana', displayName: 'Ana' },
              { id: 'bob', displayName: 'Bob' },
              { id: 'carla', displayName: 'Carla' },
            ],
            scoring: {
              categories: [
                { id: 'presentation', name: 'Presentation' },
                { id: 'taste', name: 'Taste' },
              ],
              range: { type: 'fixed', min: 1, max: 10 },
              uniquePerCategory: false,
            },
          },
          clarifiesAbout: ['attribution'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'partial-attribution-asked-then-answered',
    category: 'partial_clarify',
    note: 'The high-stakes case: attribution is never guessable, so turn 1 must ask and must not fill it in. Turn 2 answers it.',
    turns: [
      {
        message:
          'Contest called Duo Tapas. Ana (id ana) and Bob (id bob) are partners and cook together. Taste, 1 to 5, repeats allowed.',
        expect: {
          fields: {
            name: 'Duo Tapas',
            participants: [
              { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
              { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
            ],
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'fixed', min: 1, max: 5 },
              uniquePerCategory: false,
            },
          },
          clarifiesAbout: ['attribution'],
          absent: ['attribution'],
        },
      },
      {
        message: 'The dish is credited to the couple, not to one of them.',
        expect: {
          fields: {
            name: 'Duo Tapas',
            attribution: 'per_couple',
            participants: [
              { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
              { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
            ],
          },
          clarifiesAbout: [],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'partial-reply-corrects-earlier-field',
    category: 'partial_clarify',
    note: 'The reply changes its mind about a field already settled. The merge rule says the reply wins — a correction must overwrite, not be ignored in favour of the carried-over value.',
    turns: [
      {
        message: 'Contest called Autumn Tapas, judged on taste from 1 to 5, repeats allowed.',
        expect: {
          fields: {
            name: 'Autumn Tapas',
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'fixed', min: 1, max: 5 },
              uniquePerCategory: false,
            },
          },
          clarifiesAbout: ['participants', 'attribution'],
          absent: [],
        },
      },
      {
        message: 'Actually, call it Harvest Tapas, and make the scale 1 to 10 instead.',
        expect: {
          fields: {
            name: 'Harvest Tapas',
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'fixed', min: 1, max: 10 },
              uniquePerCategory: false,
            },
          },
          clarifiesAbout: ['participants', 'attribution'],
          absent: [],
        },
      },
    ],
  },
];
