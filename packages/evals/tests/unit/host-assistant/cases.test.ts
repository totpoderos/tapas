import { describe, expect, it } from 'vitest';
import { HOST_ASSISTANT_CASES } from '../../../cases/host-assistant/index.js';
import { HA_GROUPS, HA_TOOL_NAMES, parseHostAssistantCases } from '../../../src/host-assistant/case.js';

/**
 * Structural guards on the frozen set — deterministic, hard-gated. The model's
 * behaviour is threshold-gated (Slice H6c); the set being well-formed is an
 * ordinary invariant, exactly as the creation eval treats its 25 cases.
 *
 * The set grew from 30 to 50 when the assistant gained the draft edits and
 * by-name addressing: it covered 9 of the tools while the catalogue offered 21,
 * so twelve of them were measured by nothing at all. Changing these counts is
 * meant to be deliberate — a new tool that nobody wrote a case for fails here
 * rather than quietly going unmeasured.
 */
describe('host-assistant frozen case set', () => {
  const cases = parseHostAssistantCases(HOST_ASSISTANT_CASES);

  it('has 51 cases split 21 / 10 / 6 / 8 / 6 across the five groups', () => {
    expect(cases).toHaveLength(51);
    const counts = Object.fromEntries(HA_GROUPS.map((group) => [group, cases.filter((c) => c.group === group).length]));
    expect(counts).toEqual({
      single_tool: 21,
      multi_tool: 10,
      clarification: 6,
      destructive: 8,
      adversarial: 6,
    });
  });

  /*
   * The check the counts alone cannot make. Twelve tools were shipped with no
   * case at all, which no failing test noticed — the set was well-formed, just
   * blind. A tool the assistant offers and nobody measures is the gap this
   * closes.
   */
  it('measures every tool the assistant may propose', () => {
    const measured = new Set(cases.flatMap((c) => c.expect.tools.map((tool) => tool.name)));
    expect([...HA_TOOL_NAMES].filter((name) => !measured.has(name))).toEqual([]);
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
