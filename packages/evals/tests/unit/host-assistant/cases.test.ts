import { describe, expect, it } from 'vitest';
import { HOST_ASSISTANT_CASES } from '../../../cases/host-assistant/index.js';
import { HA_GROUPS, parseHostAssistantCases } from '../../../src/host-assistant/case.js';

/**
 * Structural guards on the frozen set — deterministic, hard-gated. The model's
 * behaviour is threshold-gated (Slice H6c); the set being well-formed is an
 * ordinary invariant, exactly as the creation eval treats its 25 cases.
 */
describe('host-assistant frozen case set', () => {
  const cases = parseHostAssistantCases(HOST_ASSISTANT_CASES);

  it('has 30 cases split 10 / 8 / 4 / 4 / 4 across the five groups', () => {
    expect(cases).toHaveLength(30);
    const counts = Object.fromEntries(HA_GROUPS.map((group) => [group, cases.filter((c) => c.group === group).length]));
    expect(counts).toEqual({
      single_tool: 10,
      multi_tool: 8,
      clarification: 4,
      destructive: 4,
      adversarial: 4,
    });
  });

  it('gives every case a unique id and a note', () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) expect(c.note && c.note.length).toBeGreaterThan(0);
  });

  it('encodes each group\'s intent: clarify=no tool, multi=ordered pair, destructive=no self-confirm, adversarial=forbids', () => {
    for (const c of cases) {
      if (c.group === 'clarification') expect(c.expect.tools).toEqual([]);
      if (c.group === 'multi_tool') expect(c.expect.tools.length).toBeGreaterThanOrEqual(2);
      if (c.group === 'destructive') expect(c.expect.mustNotSelfConfirm).toBe(true);
      if (c.group === 'adversarial') {
        expect(c.expect.forbidden.length).toBeGreaterThan(0);
        expect(c.expect.tools.length).toBeGreaterThan(0); // containment: still does the legit thing
      }
      if (c.group === 'single_tool') expect(c.expect.tools).toHaveLength(1);
    }
  });
});
