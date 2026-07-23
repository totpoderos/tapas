import type { EvalCase } from '../../src/case.js';

/**
 * Simple cases (8) — one turn, everything the host wants stated outright, one
 * or two fields at a time. These are the floor: if these fail, nothing further
 * up the rule space is meaningful. They exist to isolate plain extraction from
 * the domain reasoning exercised in `domain.ts`.
 */
export const SIMPLE_CASES: EvalCase[] = [
  {
    id: 'simple-name-only',
    category: 'simple',
    note: 'The smallest possible extraction. Everything else is high-stakes and must be asked about, never defaulted.',
    turns: [
      {
        message: 'I want to run a tapas contest called Summer Tapas 2026.',
        expect: {
          fields: { name: 'Summer Tapas 2026' },
          clarifiesAbout: ['participants', 'scoring', 'attribution'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'simple-name-and-participants',
    category: 'simple',
    note: 'Participants given with explicit ids, so there is nothing to infer.',
    turns: [
      {
        message:
          'Contest called Tapas Night. The cooks are Ana (id ana), Bob (id bob) and Carla (id carla).',
        expect: {
          fields: {
            name: 'Tapas Night',
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
    ],
  },
  {
    id: 'simple-categories-and-fixed-range',
    category: 'simple',
    note: 'One category, one explicit fixed range, repeats allowed.',
    turns: [
      {
        message:
          'A contest called Pintxo Cup. Judge every dish on taste only, scored from 1 to 5, and the same score may be used more than once.',
        expect: {
          fields: {
            name: 'Pintxo Cup',
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
    ],
  },
  {
    id: 'simple-attribution-per-person',
    category: 'simple',
    note: 'Attribution is high-stakes: stated outright here, so it must be extracted rather than asked about.',
    turns: [
      {
        message:
          'Contest called Solo Tapas. Ana (id ana) and Bob (id bob) are cooking, and each dish is credited to the individual person who made it.',
        expect: {
          fields: {
            name: 'Solo Tapas',
            attribution: 'per_person',
            participants: [
              { id: 'ana', displayName: 'Ana' },
              { id: 'bob', displayName: 'Bob' },
            ],
          },
          clarifiesAbout: ['scoring'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'simple-close-rule-all-sent',
    category: 'simple',
    note: 'closeRule is defaultable, but here the host says it, so it should come back as stated.',
    turns: [
      {
        message:
          'Contest called Quick Tapas. Close the voting as soon as everyone has sent their votes.',
        expect: {
          fields: { name: 'Quick Tapas', closeRule: { when: 'all_sent' } },
          clarifiesAbout: ['participants', 'scoring'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'simple-reveal-host-trigger',
    category: 'simple',
    note: 'revealStrategy stated outright — the host wants the reveal to be a deliberate beat.',
    turns: [
      {
        message:
          'Contest called Gala Tapas. I want to announce the winners myself, when I decide the moment is right.',
        expect: {
          fields: { name: 'Gala Tapas', revealStrategy: { when: 'host_trigger' } },
          clarifiesAbout: ['participants', 'scoring'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'simple-anti-bias-none',
    category: 'simple',
    note: 'antiBias none said explicitly. The baseline "never score your own dish" is not a rule the host chooses, so it must not surface as a field.',
    turns: [
      {
        message:
          'Contest called Open Tapas. There are no restrictions on who may score whom — anyone can score anyone.',
        expect: {
          fields: { name: 'Open Tapas', antiBias: 'none' },
          clarifiesAbout: ['participants', 'scoring'],
          absent: [],
        },
      },
    ],
  },
  {
    id: 'simple-repeats-allowed',
    category: 'simple',
    note: 'uniquePerCategory false stated in plain language rather than jargon.',
    turns: [
      {
        message:
          'Contest called Repeat Tapas. Score presentation from 1 to 10, and two dishes are allowed to get the same score.',
        expect: {
          fields: {
            name: 'Repeat Tapas',
            scoring: {
              categories: [{ id: 'presentation', name: 'Presentation' }],
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
