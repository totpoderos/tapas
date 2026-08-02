import { describe, expect, it } from 'vitest';
import { CREATION_CASES } from '../../cases/creation/index.js';
import { FIELD_NAMES, parseCases, type Category } from '../../src/index.js';

/**
 * Structural guards on the frozen case set. These are deterministic and hard-
 * gate: the *model's* behaviour is threshold-gated, but the eval set itself
 * being well-formed and correctly proportioned is an ordinary invariant.
 */
describe('the contest-creation case set', () => {
  const cases = parseCases(CREATION_CASES);

  it('parses against the case schema', () => {
    expect(() => parseCases(CREATION_CASES)).not.toThrow();
  });

  it('has the 25 cases design.md §10.1 fixes', () => {
    expect(cases).toHaveLength(25);
  });

  it.each([
    ['simple', 8],
    ['domain', 10],
    ['partial_clarify', 4],
    ['adversarial', 3],
  ] as [Category, number][])('has %i %s cases', (category, expected) => {
    expect(cases.filter((c) => c.category === category)).toHaveLength(expected);
  });

  it('gives every case a unique id', () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it('explains why every case exists', () => {
    expect(cases.filter((c) => !c.note?.trim())).toEqual([]);
  });

  it('makes every partial+clarify case genuinely multi-turn', () => {
    const single = cases.filter((c) => c.category === 'partial_clarify' && c.turns.length < 2);
    expect(single).toEqual([]);
  });

  it('has every adversarial case name the field the attack targets', () => {
    // An adversarial case that forbids nothing would pass vacuously.
    const toothless = cases.filter(
      (c) => c.category === 'adversarial' && c.turns.every((t) => t.expect.absent.length === 0),
    );
    expect(toothless).toEqual([]);
  });

  it('still expects legitimate extraction to succeed under attack', () => {
    // Containment, not refusal: an adversarial case must also assert that the
    // assistant kept doing its job, or it would pass if the model fell over.
    const noPositiveClaim = cases.filter(
      (c) =>
        c.category === 'adversarial' &&
        c.turns.every((t) => Object.keys(t.expect.fields).length === 0),
    );
    expect(noPositiveClaim).toEqual([]);
  });

  it('never expects and forbids the same field in one turn', () => {
    const contradictory = cases.flatMap((c) =>
      c.turns
        .filter((t) => t.expect.absent.some((field) => field in t.expect.fields))
        .map(() => c.id),
    );
    expect(contradictory).toEqual([]);
  });

  it('only asserts fields the assistant can actually propose', () => {
    const known = new Set<string>(FIELD_NAMES);
    const unknown = cases.flatMap((c) =>
      c.turns.flatMap((t) => Object.keys(t.expect.fields).filter((f) => !known.has(f))),
    );
    expect(unknown).toEqual([]);
  });

  it('exercises every axis of the rule space across the domain cases', () => {
    const domain = cases.filter((c) => c.category === 'domain');
    const values = JSON.stringify(domain);

    for (const axis of ['solo', 'solo_with_partners', 'couples']) {
      expect(values, `no domain case covers ${axis}`).toContain(axis);
    }
    // Both range kinds and both uniqueness settings.
    expect(values).toContain('"type":"auto"');
    expect(values).toContain('"type":"fixed"');
    expect(values).toContain('"uniquePerCategory":true');
    expect(values).toContain('"uniquePerCategory":false');
  });
});
