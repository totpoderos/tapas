import { describe, expect, it } from 'vitest';
import { checkThresholds } from '../../src/gate.js';
import { CREATION_THRESHOLDS, HOST_ASSISTANT_THRESHOLDS } from '../../src/thresholds.js';

// The adopted-v2 numbers from the trajectory docs, as fractions.
const CREATION_V2 = {
  schemaValidity: 0.897,
  fieldAccuracy: 0.882,
  missingFieldRecall: 0.841,
  falseFieldRate: 0.0,
};

const HOST_ASSISTANT_V2 = {
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
    const result = checkThresholds(HOST_ASSISTANT_V2, HOST_ASSISTANT_THRESHOLDS);
    expect(result.passed).toBe(true);
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
