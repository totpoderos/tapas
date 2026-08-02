/**
 * Committed eval thresholds — the machine-readable source the CI threshold gate
 * (tasks.md 6.3) enforces. These mirror the "Committed thresholds" tables in
 * `docs/eval-trajectory.md` and `docs/host-assistant-eval-trajectory.md`, which
 * carry the rationale for each number; keep the two in sync.
 *
 * Design (design.md §11A.3/4): deterministic tests HARD-gate the build; evals are
 * THRESHOLD-gated on a separate track because a real model's output is not ours
 * to make deterministic. A floor blocks when a metric drops BELOW it; a ceiling
 * blocks when a metric climbs ABOVE it. These are floors to hold and raise as the
 * model/prompt improve — not targets — set from the adopted run with margin for
 * the small local model's timeout noise, so the gate catches a real regression
 * (a prompt collapse) without flapping.
 *
 * All bounds are fractions in [0, 1] (the metrics are fractions), matching the
 * `Metrics` / `HAMetrics` shapes the eval reports carry under `overall`.
 */

export type ThresholdKind = 'floor' | 'ceiling';

export interface Threshold {
  /** Key into the report's `overall` metrics object. */
  readonly metric: string;
  /** Human label for the gate output. */
  readonly label: string;
  readonly kind: ThresholdKind;
  /** The bound, as a fraction in [0, 1]. */
  readonly bound: number;
}

/** Contest-creation extraction eval (`docs/eval-trajectory.md`). */
export const CREATION_THRESHOLDS: readonly Threshold[] = [
  { metric: 'schemaValidity', label: 'Schema validity', kind: 'floor', bound: 0.7 },
  { metric: 'fieldAccuracy', label: 'Field accuracy', kind: 'floor', bound: 0.75 },
  { metric: 'missingFieldRecall', label: 'Missing-field recall', kind: 'floor', bound: 0.75 },
  { metric: 'falseFieldRate', label: 'False-field rate', kind: 'ceiling', bound: 0.05 },
];

/**
 * Host-assistant tool-use eval (`docs/host-assistant-eval-trajectory.md`).
 *
 * Raised wholesale when the assistant moved to a hosted `gemma4:31b-cloud` and
 * the case set grew to 50. The old floors were calibrated against a small local
 * model scoring 25-65 on its weakest metrics; against a model that scores 100
 * they could not fail for any reason short of total collapse, which is a gate
 * that does not gate.
 *
 * Every metric was observed at 1.0 (false-tool at 0.0) on case set
 * `ae8116223b65`. The floors sit below that with room for a case or two to
 * wobble — one case is 2% of the set — so a genuine regression blocks and
 * ordinary variance does not.
 *
 * Set from a SINGLE run on this case set. They are floors to hold and raise,
 * and they want revisiting once a few runs have shown what the real spread is;
 * a floor set from one observation is a hypothesis, not a measurement.
 */
export const HOST_ASSISTANT_THRESHOLDS: readonly Threshold[] = [
  { metric: 'toolSelectionAccuracy', label: 'Tool-selection accuracy', kind: 'floor', bound: 0.9 },
  { metric: 'toolArgumentAccuracy', label: 'Tool-argument accuracy', kind: 'floor', bound: 0.9 },
  { metric: 'clarificationAccuracy', label: 'Clarification accuracy', kind: 'floor', bound: 0.9 },
  { metric: 'schemaValidity', label: 'Schema validity', kind: 'floor', bound: 0.95 },
  { metric: 'falseToolRate', label: 'False-tool rate', kind: 'ceiling', bound: 0.05 },
  { metric: 'chainingCorrectness', label: 'Chaining correctness', kind: 'floor', bound: 0.8 },
  { metric: 'confirmationSurfacing', label: 'Confirmation surfacing', kind: 'floor', bound: 0.9 },
];

export const THRESHOLDS_BY_SUITE = {
  creation: CREATION_THRESHOLDS,
  'host-assistant': HOST_ASSISTANT_THRESHOLDS,
} as const;

export type EvalSuite = keyof typeof THRESHOLDS_BY_SUITE;
