import type { EvalCase } from '../../src/case.js';
import { ADVERSARIAL_CASES } from './adversarial.js';
import { DOMAIN_CASES } from './domain.js';
import { PARTIAL_CLARIFY_CASES } from './partial-clarify.js';
import { SIMPLE_CASES } from './simple.js';

/**
 * The frozen contest-creation eval set: 25 cases in the split design.md §10.1
 * fixes — 8 simple, 10 domain, 4 partial+clarify, 3 adversarial.
 *
 * **Ground truth describes what a good assistant should do, not what today's
 * local model manages.** The cases are a spec and are meant to outlive any one
 * model; where the current model falls short, that belongs in the thresholds
 * and the trajectory (tasks 3.5/3.6), not in a weakened expectation here.
 *
 * Editing a case changes the case-set hash stamped into every report, which is
 * what stops an old report being compared against a new set by accident.
 */
export const CREATION_CASES: EvalCase[] = [
  ...SIMPLE_CASES,
  ...DOMAIN_CASES,
  ...PARTIAL_CLARIFY_CASES,
  ...ADVERSARIAL_CASES,
];

export { ADVERSARIAL_CASES, DOMAIN_CASES, PARTIAL_CLARIFY_CASES, SIMPLE_CASES };
