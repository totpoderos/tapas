import { describe, expect, it } from 'vitest';
import { ExpectationSchema, scoreTurn, sumCounts, toMetrics, type TurnOutcome } from '../../src/index.js';

function expectation(partial: Record<string, unknown>) {
  return ExpectationSchema.parse(partial);
}

function outcome(partial: Partial<TurnOutcome> = {}): TurnOutcome {
  return { fields: {}, clarifications: [], noToolCall: false, rejectedFields: [], ...partial };
}

describe('scoreTurn', () => {
  it('counts a turn as schema-valid only when a tool call arrived with nothing rejected', () => {
    const valid = scoreTurn(outcome(), expectation({}));
    const noCall = scoreTurn(outcome({ noToolCall: true }), expectation({}));
    const rejected = scoreTurn(outcome({ rejectedFields: ['scoring'] }), expectation({}));

    expect(valid.schemaValid).toBe(1);
    expect(noCall.schemaValid).toBe(0);
    expect(rejected.schemaValid).toBe(0);
  });

  it('keeps the two schema failures separable in the counts', () => {
    const noCall = scoreTurn(outcome({ noToolCall: true }), expectation({}));
    const rejected = scoreTurn(outcome({ rejectedFields: ['scoring'] }), expectation({}));

    expect([noCall.noToolCall, noCall.fieldRejected]).toEqual([1, 0]);
    expect([rejected.noToolCall, rejected.fieldRejected]).toEqual([0, 1]);
  });

  it('compares only the expected fields that actually appeared', () => {
    const counts = scoreTurn(
      outcome({ fields: { name: 'Summer Tapas' } }),
      expectation({ fields: { name: 'Summer Tapas', attribution: 'per_person' } }),
    );

    // attribution never arrived — that is a recall miss, not an accuracy miss.
    expect(counts.fieldsCompared).toBe(1);
    expect(counts.fieldsCorrect).toBe(1);
  });

  it('marks a field that appeared with the wrong value as incorrect', () => {
    const counts = scoreTurn(
      outcome({ fields: { name: 'Winter Tapas' } }),
      expectation({ fields: { name: 'Summer Tapas' } }),
    );

    expect(counts.fieldsCompared).toBe(1);
    expect(counts.fieldsCorrect).toBe(0);
  });

  it('compares structured field values deeply, ignoring key order', () => {
    const counts = scoreTurn(
      outcome({ fields: { scoring: { range: { max: 5, min: 1, type: 'fixed' }, categories: [] } } }),
      expectation({ fields: { scoring: { categories: [], range: { type: 'fixed', min: 1, max: 5 } } } }),
    );

    expect(counts.fieldsCorrect).toBe(1);
  });

  it('credits a clarification that asks about the expected field', () => {
    const counts = scoreTurn(
      outcome({ clarifications: ['Who is participating in the contest?'] }),
      expectation({ clarifiesAbout: ['participants'] }),
    );

    expect(counts.clarificationsHit).toBe(1);
    expect(counts.clarificationsExpected).toBe(1);
  });

  it('does not credit a clarification about some other field', () => {
    const counts = scoreTurn(
      outcome({ clarifications: ['What should the contest be called?'] }),
      expectation({ clarifiesAbout: ['participants'] }),
    );

    expect(counts.clarificationsHit).toBe(0);
  });

  it('counts an explicitly forbidden field as a false field', () => {
    const counts = scoreTurn(
      outcome({ fields: { name: 'Trick Tapas', attribution: 'per_couple' } }),
      expectation({ fields: { name: 'Trick Tapas' }, absent: ['attribution'] }),
    );

    expect(counts.falseFields).toBe(1);
    expect(counts.fieldsProduced).toBe(2);
  });

  it('does not count a field the case simply makes no claim about', () => {
    // Asserting a subset must not be punished: a case that only cares about
    // the name should not be docked for a correctly-extracted reveal strategy.
    const counts = scoreTurn(
      outcome({ fields: { name: 'Summer Tapas', revealStrategy: { when: 'host_trigger' } } }),
      expectation({ fields: { name: 'Summer Tapas' } }),
    );

    expect(counts.falseFields).toBe(0);
  });

  it('makes no false-field claim when the case asserts no fields at all', () => {
    const counts = scoreTurn(
      outcome({ fields: { name: 'Summer Tapas' } }),
      expectation({ clarifiesAbout: ['participants'] }),
    );

    expect(counts.falseFields).toBe(0);
  });
});

describe('toMetrics', () => {
  it('turns summed counts into the four ratios', () => {
    const metrics = toMetrics({
      schemaValid: 3,
      turns: 4,
      noToolCall: 1,
      fieldRejected: 0,
      fieldsCorrect: 3,
      fieldsCompared: 6,
      clarificationsHit: 1,
      clarificationsExpected: 4,
      falseFields: 1,
      fieldsProduced: 10,
    });

    expect(metrics.schemaValidity).toBe(0.75);
    expect(metrics.fieldAccuracy).toBe(0.5);
    expect(metrics.missingFieldRecall).toBe(0.25);
    expect(metrics.falseFieldRate).toBe(0.1);
  });

  it('reports a vacuous metric as 1 rather than 0 or NaN', () => {
    const metrics = toMetrics({
      schemaValid: 1,
      turns: 1,
      noToolCall: 0,
      fieldRejected: 0,
      fieldsCorrect: 0,
      fieldsCompared: 0,
      clarificationsHit: 0,
      clarificationsExpected: 0,
      falseFields: 0,
      fieldsProduced: 0,
    });

    expect(metrics.fieldAccuracy).toBe(1);
    expect(metrics.missingFieldRecall).toBe(1);
    expect(metrics.falseFieldRate).toBe(0);
  });

  it('weighs a long case more than a short one, rather than averaging ratios', () => {
    // One 3-turn case at 0/3 and one 1-turn case at 1/1 is 1/4, not the 0.5
    // a mean of per-case ratios would give.
    const longCase = sumCounts([
      { ...ZEROED, turns: 3, schemaValid: 0 },
    ]);
    const shortCase = sumCounts([{ ...ZEROED, turns: 1, schemaValid: 1 }]);

    expect(toMetrics(sumCounts([longCase, shortCase])).schemaValidity).toBe(0.25);
  });
});

const ZEROED = {
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
