import { FIELD_NAMES, type Expectation, type FieldName } from './case.js';
import { asksAbout } from './clarification-match.js';

/** What one turn actually produced, normalized away from the API's shapes. */
export interface TurnOutcome {
  /** Field values the assistant proposed, with source tags stripped. */
  readonly fields: Partial<Record<FieldName, unknown>>;
  readonly clarifications: readonly string[];
  /** The model produced no usable tool call at all. */
  readonly noToolCall: boolean;
  /** Fields dropped because they failed per-field re-validation. */
  readonly rejectedFields: readonly FieldName[];
}

/**
 * Counts, not ratios. Metrics are summed across turns and cases before being
 * divided, so that a case with three turns weighs three turns' worth — taking
 * a mean of per-turn ratios would let a one-turn case outweigh a three-turn
 * one on the same evidence.
 */
export interface MetricCounts {
  readonly schemaValid: number;
  readonly turns: number;
  readonly noToolCall: number;
  readonly fieldRejected: number;

  readonly fieldsCorrect: number;
  readonly fieldsCompared: number;

  readonly clarificationsHit: number;
  readonly clarificationsExpected: number;

  readonly falseFields: number;
  readonly fieldsProduced: number;
}

export const ZERO_COUNTS: MetricCounts = {
  schemaValid: 0,
  turns: 0,
  noToolCall: 0,
  fieldRejected: 0,
  fieldsCorrect: 0,
  fieldsCompared: 0,
  clarificationsHit: 0,
  clarificationsExpected: 0,
  falseFields: 0,
  fieldsProduced: 0,
};

export interface Metrics {
  /** Fraction of turns that produced a usable tool call with no field rejected. */
  readonly schemaValidity: number;
  /** Of expected fields that appeared, the fraction matching ground truth. */
  readonly fieldAccuracy: number;
  /** Of fields that should have been asked about, the fraction that were. */
  readonly missingFieldRecall: number;
  /** Of fields produced, the fraction ground truth does not sanction. */
  readonly falseFieldRate: number;
}

/** Scores one turn against its expectation. */
export function scoreTurn(outcome: TurnOutcome, expected: Expectation): MetricCounts {
  const schemaValid = !outcome.noToolCall && outcome.rejectedFields.length === 0;

  const expectedFields = Object.keys(expected.fields) as FieldName[];
  const produced = FIELD_NAMES.filter((field) => outcome.fields[field] !== undefined);

  // Only fields that actually appeared are compared. A field that never
  // arrived is a recall miss, not an accuracy miss — counting it as both
  // would penalize a single mistake twice.
  const compared = expectedFields.filter((field) => outcome.fields[field] !== undefined);
  const correct = compared.filter((field) => deepEqual(outcome.fields[field], expected.fields[field]));

  const clarificationsHit = expected.clarifiesAbout.filter((field) =>
    asksAbout(outcome.clarifications, field),
  );

  // A produced field is "false" only when ground truth explicitly forbids it.
  // Treating any *unasserted* field as false was tried first and is wrong: it
  // punishes a case for asserting a subset, so the adversarial seed case —
  // which rightly cares only about attribution — was docked for extracting
  // participants correctly. Forbidding must be stated, not inferred.
  const forbidden = new Set<FieldName>(expected.absent);
  const falseFields = produced.filter((field) => forbidden.has(field));

  return {
    schemaValid: schemaValid ? 1 : 0,
    turns: 1,
    noToolCall: outcome.noToolCall ? 1 : 0,
    fieldRejected: outcome.rejectedFields.length > 0 ? 1 : 0,
    fieldsCorrect: correct.length,
    fieldsCompared: compared.length,
    clarificationsHit: clarificationsHit.length,
    clarificationsExpected: expected.clarifiesAbout.length,
    falseFields: falseFields.length,
    fieldsProduced: produced.length,
  };
}

export function addCounts(a: MetricCounts, b: MetricCounts): MetricCounts {
  return {
    schemaValid: a.schemaValid + b.schemaValid,
    turns: a.turns + b.turns,
    noToolCall: a.noToolCall + b.noToolCall,
    fieldRejected: a.fieldRejected + b.fieldRejected,
    fieldsCorrect: a.fieldsCorrect + b.fieldsCorrect,
    fieldsCompared: a.fieldsCompared + b.fieldsCompared,
    clarificationsHit: a.clarificationsHit + b.clarificationsHit,
    clarificationsExpected: a.clarificationsExpected + b.clarificationsExpected,
    falseFields: a.falseFields + b.falseFields,
    fieldsProduced: a.fieldsProduced + b.fieldsProduced,
  };
}

export function sumCounts(all: readonly MetricCounts[]): MetricCounts {
  return all.reduce(addCounts, ZERO_COUNTS);
}

/**
 * A metric with an empty denominator is reported as 1, not 0 or NaN: "no
 * fields were expected, so none were got wrong" is a vacuous success, and
 * reporting it as failure would punish cases that legitimately assert nothing.
 */
function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

export function toMetrics(counts: MetricCounts): Metrics {
  return {
    schemaValidity: ratio(counts.schemaValid, counts.turns),
    fieldAccuracy: ratio(counts.fieldsCorrect, counts.fieldsCompared),
    missingFieldRecall: ratio(counts.clarificationsHit, counts.clarificationsExpected),
    falseFieldRate: counts.fieldsProduced === 0 ? 0 : counts.falseFields / counts.fieldsProduced,
  };
}

/** Order-insensitive for object keys, order-sensitive for arrays. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a !== 'object') return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left).filter((k) => left[k] !== undefined);
  const rightKeys = Object.keys(right).filter((k) => right[k] !== undefined);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => deepEqual(left[key], right[key]));
}
