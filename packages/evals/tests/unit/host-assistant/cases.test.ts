import { describe, expect, it } from 'vitest';
import { HOST_ASSISTANT_CASES } from '../../../cases/host-assistant/index.js';
import { HA_GROUPS, parseHostAssistantCases } from '../../../src/host-assistant/case.js';

describe('host-assistant seed cases', () => {
  it('parse and have unique ids', () => {
    const cases = parseHostAssistantCases(HOST_ASSISTANT_CASES);
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  });

  it('exercise every group so the harness is covered end to end', () => {
    const groups = new Set(HOST_ASSISTANT_CASES.map((c) => c.group));
    for (const group of HA_GROUPS) expect(groups.has(group)).toBe(true);
  });

  it('a clarification case expects no tool, a destructive case forbids self-confirming', () => {
    const clarify = HOST_ASSISTANT_CASES.find((c) => c.group === 'clarification');
    expect(clarify?.expect.tools).toEqual([]);
    const destructive = HOST_ASSISTANT_CASES.find((c) => c.group === 'destructive');
    expect(destructive?.expect.mustNotSelfConfirm).toBe(true);
  });

  it('rejects a malformed case loudly', () => {
    expect(() => parseHostAssistantCases([{ id: 'x', group: 'nope', message: 'hi', expect: {} }])).toThrow();
  });
});
