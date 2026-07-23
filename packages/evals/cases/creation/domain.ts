import type { EvalCase } from '../../src/case.js';

/**
 * Domain cases (10) — the rule space the Phase 1 compiler implements
 * (glossary.md, "The rule space"). These are the cases that matter most: they
 * test whether the assistant understands attribution, anti-bias, range
 * resolution and uniqueness as *domain concepts*, not just as strings it can
 * copy out of a sentence. Three of them are the named variants — Strict,
 * Permissive and Joint — the same points in the rule space the compiler's
 * acceptance spec uses.
 */
export const DOMAIN_CASES: EvalCase[] = [
  {
    id: 'domain-variant-strict',
    category: 'domain',
    note: 'The Strict variant: per_person, couples barred, auto range, unique scores. Every rule-space axis at once.',
    turns: [
      {
        message:
          'Contest called Strict Tapas. Ana (id ana) and Bob (id bob) are a couple; Carla (id carla) and Dan (id dan) are a couple. Credit each dish to the individual cook. Partners must not score each other. Score on taste, and each judge must give every score exactly once — as many points as there are dishes they can score.',
        expect: {
          fields: {
            name: 'Strict Tapas',
            attribution: 'per_person',
            antiBias: 'couples',
            participants: [
              { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
              { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
              { id: 'carla', displayName: 'Carla', partnerId: 'dan' },
              { id: 'dan', displayName: 'Dan', partnerId: 'carla' },
            ],
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'auto' },
              uniquePerCategory: true,
            },
          },
          clarifiesAbout: [],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'domain-variant-permissive',
    category: 'domain',
    note: 'The Permissive variant: per_person, couples barred, fixed 1..10, repeats allowed.',
    turns: [
      {
        message:
          'Contest called Permissive Tapas. Ana (id ana) and Bob (id bob) are partners. Dishes belong to the individual cook, partners may not score each other, and everything is scored on taste from 1 to 10 with repeats allowed.',
        expect: {
          fields: {
            name: 'Permissive Tapas',
            attribution: 'per_person',
            antiBias: 'couples',
            participants: [
              { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
              { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
            ],
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'fixed', min: 1, max: 10 },
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
    id: 'domain-variant-joint',
    category: 'domain',
    note: 'The Joint variant: per_couple attribution — the dish belongs to the pair, not the person.',
    turns: [
      {
        message:
          'Contest called Joint Tapas. Ana (id ana) and Bob (id bob) cook together as a couple, and Carla (id carla) and Dan (id dan) do too. A dish belongs to the couple that made it, not to one person. Couples may not score each other. Taste, 1 to 10, repeats allowed.',
        expect: {
          fields: {
            name: 'Joint Tapas',
            attribution: 'per_couple',
            antiBias: 'couples',
            participants: [
              { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
              { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
              { id: 'carla', displayName: 'Carla', partnerId: 'dan' },
              { id: 'dan', displayName: 'Dan', partnerId: 'carla' },
            ],
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'fixed', min: 1, max: 10 },
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
    id: 'domain-auto-range',
    category: 'domain',
    note: 'Auto range described in the host\'s words ("as many points as dishes") rather than named. Must resolve to type auto, not a fixed guess.',
    turns: [
      {
        message:
          'Contest called Auto Tapas. Score on taste, where each judge has as many points to hand out as there are dishes they are allowed to score, using each one once.',
        expect: {
          fields: {
            name: 'Auto Tapas',
            scoring: {
              categories: [{ id: 'taste', name: 'Taste' }],
              range: { type: 'auto' },
              uniquePerCategory: true,
            },
          },
          clarifiesAbout: ['participants', 'attribution'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'domain-arbitrary-pairs',
    category: 'domain',
    note: 'arbitrary_pairs: a bar between two people who are not a couple, carried on noScoreWith.',
    turns: [
      {
        message:
          'Contest called Feud Tapas. Ana (id ana), Bob (id bob) and Carla (id carla) are cooking. Ana and Carla must not score each other — they are not a couple, they simply cannot judge each other fairly. Everyone else can score anyone.',
        expect: {
          fields: {
            name: 'Feud Tapas',
            antiBias: 'arbitrary_pairs',
            participants: [
              { id: 'ana', displayName: 'Ana', noScoreWith: ['carla'] },
              { id: 'bob', displayName: 'Bob' },
              { id: 'carla', displayName: 'Carla', noScoreWith: ['ana'] },
            ],
          },
          clarifiesAbout: ['scoring', 'attribution'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'domain-per-couple-attribution',
    category: 'domain',
    note: 'per_couple stated without the word "couple" being used for the anti-bias rule — attribution and anti-bias must not be conflated.',
    turns: [
      {
        message:
          'Contest called Pairs Tapas. Ana (id ana) cooks with her partner Bob (id bob), and the dish is credited to them jointly. Anyone may score anyone, including partners.',
        expect: {
          fields: {
            name: 'Pairs Tapas',
            attribution: 'per_couple',
            antiBias: 'none',
            participants: [
              { id: 'ana', displayName: 'Ana', partnerId: 'bob' },
              { id: 'bob', displayName: 'Bob', partnerId: 'ana' },
            ],
          },
          clarifiesAbout: ['scoring'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'domain-unique-per-category',
    category: 'domain',
    note: 'uniquePerCategory true described as a ranking ("each score used once"), the strict-permutation reading.',
    turns: [
      {
        message:
          'Contest called Ranking Tapas. Score presentation from 1 to 5, and within presentation each judge must use every score exactly once — no two dishes may get the same number.',
        expect: {
          fields: {
            name: 'Ranking Tapas',
            scoring: {
              categories: [{ id: 'presentation', name: 'Presentation' }],
              range: { type: 'fixed', min: 1, max: 5 },
              uniquePerCategory: true,
            },
          },
          clarifiesAbout: ['participants', 'attribution'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'domain-three-categories-inferred',
    category: 'domain',
    note: 'Categories named in prose, not as a list. Tests extraction of a structured list from a sentence.',
    turns: [
      {
        message:
          'Contest called Triple Tapas. I want dishes judged on how they look, how original they are, and how they taste — each from 1 to 5, repeats allowed.',
        expect: {
          fields: {
            name: 'Triple Tapas',
            scoring: {
              categories: [
                { id: 'presentation', name: 'Presentation' },
                { id: 'originality', name: 'Originality' },
                { id: 'taste', name: 'Taste' },
              ],
              range: { type: 'fixed', min: 1, max: 5 },
              uniquePerCategory: false,
            },
          },
          clarifiesAbout: ['participants', 'attribution'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'domain-scheduled-close',
    category: 'domain',
    note: 'A scheduled close rule carries a time, so the variant with `at` must be chosen over the bare one.',
    turns: [
      {
        message:
          'Contest called Timed Tapas. Voting closes automatically at 10pm on the 14th of August 2026 (22:00 UTC).',
        expect: {
          fields: {
            name: 'Timed Tapas',
            closeRule: { when: 'scheduled', at: '2026-08-14T22:00:00Z' },
          },
          clarifiesAbout: ['participants', 'scoring'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'domain-scheduled-reveal',
    category: 'domain',
    note: 'Scheduled reveal, distinct from the close rule — the two are separate axes and must not be collapsed.',
    turns: [
      {
        message:
          'Contest called Reveal Tapas. Close the voting once everyone has sent their votes, but do not announce the winners until 11pm on the 14th of August 2026 (23:00 UTC).',
        expect: {
          fields: {
            name: 'Reveal Tapas',
            closeRule: { when: 'all_sent' },
            revealStrategy: { when: 'scheduled', at: '2026-08-14T23:00:00Z' },
          },
          clarifiesAbout: ['participants', 'scoring'],
          absent: [],
        },
      },
    ],
  },
];
