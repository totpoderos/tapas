import type { HostAssistantCaseInput } from '../../src/host-assistant/case.js';

/**
 * Multi-tool chaining (8) — the host asks for two things; the assistant must
 * propose both tools in the right order. Ground truth pins arguments only where
 * the host stated them (the first action of a chain); it does NOT pin an
 * argument that only becomes known after the first tool runs — e.g. the draft
 * id a freshly-created draft would get — because the assistant proposes both in
 * one shot and cannot know it. Chaining is scored on order, not those args.
 */
export const MULTI_TOOL_CASES: HostAssistantCaseInput[] = [
  {
    id: 'multi-create-then-publish',
    group: 'multi_tool',
    note: 'The canonical chain: create a draft, then publish it.',
    message: 'Create a draft called "Spring Fling" and then publish it.',
    expect: { tools: [{ name: 'create_draft', arguments: { name: 'Spring Fling' } }, { name: 'publish_contest' }] },
  },
  {
    id: 'multi-close-then-reveal',
    group: 'multi_tool',
    note: 'Close a contest, then reveal it.',
    message: 'Close contest c1 and then reveal the results.',
    expect: { tools: [{ name: 'close_contest', arguments: { contestId: 'c1' } }, { name: 'trigger_reveal' }] },
  },
  {
    id: 'multi-reveal-then-results',
    group: 'multi_tool',
    note: 'Reveal a contest, then read its results.',
    message: 'Reveal contest c3 and show me the results.',
    expect: { tools: [{ name: 'trigger_reveal', arguments: { contestId: 'c3' } }, { name: 'get_results' }] },
  },
  {
    id: 'multi-create-then-get-draft',
    group: 'multi_tool',
    note: 'Create a draft, then read it back.',
    message: 'Create a draft named "Taco Tuesday" and then show it to me.',
    expect: { tools: [{ name: 'create_draft', arguments: { name: 'Taco Tuesday' } }, { name: 'get_draft' }] },
  },
  {
    id: 'multi-rename-then-publish',
    group: 'multi_tool',
    note: 'Rename a draft, then publish it.',
    message: 'Rename draft d1 to "Grand Final" and publish it.',
    expect: {
      tools: [{ name: 'update_draft', arguments: { draftId: 'd1', name: 'Grand Final' } }, { name: 'publish_contest' }],
    },
  },
  {
    id: 'multi-tally-then-close',
    group: 'multi_tool',
    note: 'Check the tally, then close the contest.',
    message: 'Check the tally for contest c2, then close it.',
    expect: { tools: [{ name: 'get_tally', arguments: { contestId: 'c2' } }, { name: 'close_contest' }] },
  },
  {
    id: 'multi-get-contest-then-tally',
    group: 'multi_tool',
    note: 'Two reads of the same contest, in order.',
    message: 'Show me contest c1 and its current tally.',
    expect: { tools: [{ name: 'get_contest', arguments: { contestId: 'c1' } }, { name: 'get_tally' }] },
  },
  {
    id: 'multi-publish-then-get-contest',
    group: 'multi_tool',
    note: 'Publish a draft, then read the contest it became.',
    message: 'Publish draft d5 and then show me the new contest.',
    expect: { tools: [{ name: 'publish_contest', arguments: { draftId: 'd5' } }, { name: 'get_contest' }] },
  },
];
