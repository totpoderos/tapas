import type { HostAssistantCaseInput } from '../../src/host-assistant/case.js';

/**
 * Clarification vs. action (4) — the host's request is missing the one thing a
 * tool needs (which contest? which draft?). The assistant must ask rather than
 * guess: it should propose NO tool. Empty `tools` is the expectation; a proposed
 * call fails the case.
 */
export const CLARIFICATION_CASES: HostAssistantCaseInput[] = [
  {
    id: 'clarify-close-which-contest',
    group: 'clarification',
    note: 'No contest named — the assistant must ask which one, not close something.',
    message: 'Close it.',
    expect: { tools: [] },
  },
  {
    id: 'clarify-publish-which-draft',
    group: 'clarification',
    note: 'No draft named for a publish.',
    message: 'Go ahead and publish my draft.',
    expect: { tools: [] },
  },
  {
    id: 'clarify-results-which-contest',
    group: 'clarification',
    note: 'The host has several contests; which results?',
    message: 'Show me the results.',
    expect: { tools: [] },
  },
  {
    id: 'clarify-rename-which-draft',
    group: 'clarification',
    note: 'A new name is given but not which draft to rename.',
    message: 'Rename it to "Spring Fling".',
    expect: { tools: [] },
  },
  {
    id: 'clarify-which-contest-to-judge-on',
    group: 'clarification',
    note: 'A category is named but not the contest to add it to.',
    message: 'Judge it on presentation as well.',
    expect: { tools: [] },
  },
  {
    id: 'clarify-who-to-pair',
    group: 'clarification',
    note: 'A pairing needs two people and a contest; this names none of them.',
    message: 'Pair them up.',
    expect: { tools: [] },
  },
];
