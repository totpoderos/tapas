import { describe, expect, it } from 'vitest';
import { checkRun, checkThresholds, formatRunResult } from '../../src/gate.js';
import { CREATION_THRESHOLDS, HOST_ASSISTANT_THRESHOLDS } from '../../src/thresholds.js';

// The adopted-v2 numbers from the trajectory docs, as fractions.
const CREATION_V2 = {
  schemaValidity: 0.897,
  fieldAccuracy: 0.882,
  missingFieldRecall: 0.841,
  falseFieldRate: 0.0,
};

/** The adopted host-assistant run: `gemma4:31b-cloud`, case set `ae8116223b65`. */
const HOST_ASSISTANT_ADOPTED = {
  toolSelectionAccuracy: 1.0,
  toolArgumentAccuracy: 1.0,
  clarificationAccuracy: 1.0,
  schemaValidity: 1.0,
  falseToolRate: 0.0,
  chainingCorrectness: 1.0,
  confirmationSurfacing: 1.0,
};

/**
 * The run the floors used to be calibrated to — `gemma4:e4b` on a local Ollama,
 * 30 cases. Kept so the raise has something to have teeth against: these numbers
 * passed the old floors and must not pass the new ones, which is the whole point
 * of re-setting them when the model changed.
 */
const HOST_ASSISTANT_SMALL_LOCAL_MODEL = {
  toolSelectionAccuracy: 0.647,
  toolArgumentAccuracy: 1.0,
  clarificationAccuracy: 1.0,
  schemaValidity: 1.0,
  falseToolRate: 0.0,
  chainingCorrectness: 0.25,
  confirmationSurfacing: 0.25,
};

describe('eval threshold gate', () => {
  it('passes the adopted creation run against its floors', () => {
    const result = checkThresholds(CREATION_V2, CREATION_THRESHOLDS);
    expect(result.passed).toBe(true);
    expect(result.rows.every((r) => r.passed)).toBe(true);
  });

  it('passes the adopted host-assistant run against its floors', () => {
    const result = checkThresholds(HOST_ASSISTANT_ADOPTED, HOST_ASSISTANT_THRESHOLDS);
    expect(result.passed).toBe(true);
  });

  /*
   * A floor calibrated to a weak model cannot fail for a strong one — it stops
   * being a gate. This pins that the raise actually bites.
   */
  it('no longer passes the small local model the old floors were set for', () => {
    const result = checkThresholds(HOST_ASSISTANT_SMALL_LOCAL_MODEL, HOST_ASSISTANT_THRESHOLDS);
    expect(result.passed).toBe(false);
    expect(result.rows.filter((r) => !r.passed).map((r) => r.metric).sort()).toEqual([
      'chainingCorrectness',
      'confirmationSurfacing',
      'toolSelectionAccuracy',
    ]);
  });

  it('fails when a floor metric drops below its bound (schema-validity collapse)', () => {
    const collapsed = { ...CREATION_V2, schemaValidity: 0.586 }; // the reverted-v3 number
    const result = checkThresholds(collapsed, CREATION_THRESHOLDS);
    expect(result.passed).toBe(false);
    expect(result.rows.find((r) => r.metric === 'schemaValidity')?.passed).toBe(false);
  });

  it('fails when a ceiling metric climbs above its bound (false-field over-reach)', () => {
    const overreach = { ...CREATION_V2, falseFieldRate: 0.167 }; // the old adversarial number
    const result = checkThresholds(overreach, CREATION_THRESHOLDS);
    expect(result.passed).toBe(false);
    expect(result.rows.find((r) => r.metric === 'falseFieldRate')?.passed).toBe(false);
  });

  it('treats exactly meeting a floor/ceiling as a pass (boundary is inclusive)', () => {
    const onBound = {
      ...CREATION_V2,
      schemaValidity: 0.7, // exactly the floor
      falseFieldRate: 0.05, // exactly the ceiling
    };
    expect(checkThresholds(onBound, CREATION_THRESHOLDS).passed).toBe(true);
  });

  it('fails closed when a gated metric is missing from the report', () => {
    const { schemaValidity: _omitted, ...withoutSchema } = CREATION_V2;
    const result = checkThresholds(withoutSchema, CREATION_THRESHOLDS);
    expect(result.passed).toBe(false);
    const row = result.rows.find((r) => r.metric === 'schemaValidity');
    expect(row?.value).toBeUndefined();
    expect(row?.passed).toBe(false);
  });
});

/**
 * A run has to have measured something before its metrics mean anything.
 *
 * This is the hole a model-less CI runner fell through: all 25 creation cases
 * and all 52 host-assistant cases errored with "Failed to parse URL from
 * /chat/completions", the report read 100% on every metric "of 0 turns", and
 * the gate passed. Every floor was cleared because a ratio with no denominator
 * is reported as 1 — which is the right answer for a case that had nothing to
 * compare, and the wrong one for a run that compared nothing at all.
 *
 * So the check belongs to the run rather than to any metric: the per-metric
 * behaviour is left exactly as it was, and a run that scored nothing is refused
 * before its numbers are read. A gate that cannot fail from an outage only ever
 * catches a model that answers badly, which is the failure it is least likely
 * to meet.
 */
describe('checkRun', () => {
  const scored = { id: 'a', group: 'simple' };
  const errored = { id: 'b', group: 'simple', error: 'Failed to parse URL from /chat/completions' };

  it('accepts a run in which cases were scored', () => {
    const result = checkRun([scored, scored]);
    expect(result.measured).toBe(true);
    expect(result.scored).toBe(2);
    expect(result.errored).toBe(0);
  });

  it('refuses a run in which every case errored', () => {
    const result = checkRun([errored, errored, errored]);
    expect(result.measured).toBe(false);
    expect(result.scored).toBe(0);
    expect(result.errored).toBe(3);
  });

  it('refuses a run with no cases at all', () => {
    expect(checkRun([]).measured).toBe(false);
  });

  /*
   * A partial outage still scores what it reached, so it is not refused — but it
   * is counted, because "97% over the three cases that ran" is a number somebody
   * would otherwise read as "97%".
   */
  it('accepts a partial run and says how much of it was lost', () => {
    const result = checkRun([scored, errored, scored]);
    expect(result.measured).toBe(true);
    expect(result.scored).toBe(2);
    expect(result.errored).toBe(1);
  });

  it('says what it found, for a run that measured nothing', () => {
    expect(formatRunResult(checkRun([errored, errored]))).toMatch(/0 of 2/);
    expect(formatRunResult(checkRun([errored, errored]))).toMatch(/nothing was measured/i);
  });

  it('says nothing at all when every case was scored', () => {
    expect(formatRunResult(checkRun([scored]))).toBe('');
  });
});
