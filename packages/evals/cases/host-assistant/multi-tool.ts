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
    message: 'Close Tapas Night and then reveal the results.',
    expect: { tools: [{ name: 'close_contest', arguments: { contest: 'Tapas Night' } }, { name: 'trigger_reveal' }] },
  },
  {
    id: 'multi-reveal-then-results',
    group: 'multi_tool',
    note: 'Reveal a contest, then read its results.',
    message: 'Reveal Spring Cook-off and show me the results.',
    expect: { tools: [{ name: 'trigger_reveal', arguments: { contest: 'Spring Cook-off' } }, { name: 'get_results' }] },
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
    message: 'Rename Winter Tapas to "Grand Final" and publish it.',
    expect: {
      tools: [{ name: 'rename_contest', arguments: { contest: 'Winter Tapas', name: 'Grand Final' } }, { name: 'publish_contest' }],
    },
  },
  {
    id: 'multi-tally-then-close',
    group: 'multi_tool',
    note: 'Check the tally, then close the contest.',
    message: 'Check the tally for Sunday Roast, then close it.',
    expect: { tools: [{ name: 'get_tally', arguments: { contest: 'Sunday Roast' } }, { name: 'close_contest' }] },
  },
  {
    id: 'multi-get-contest-then-tally',
    group: 'multi_tool',
    /*
     * "Show me X" was ambiguous between the plain read and the details read, and
     * the model reasonably chose details — so the case measured its taste rather
     * than its chaining. Asking for the state names the plain read.
     */
    note: 'Two reads of the same contest, in order: its state, then its tally.',
    message: 'What state is Tapas Night in, and what is its current tally?',
    expect: { tools: [{ name: 'get_contest', arguments: { contest: 'Tapas Night' } }, { name: 'get_tally' }] },
  },
  {
    id: 'multi-publish-then-get-contest',
    group: 'multi_tool',
    note: 'Publish a draft, then read the contest it became.',
    message: 'Publish Spring Draft and then show me the new contest.',
    expect: { tools: [{ name: 'publish_contest', arguments: { contest: 'Spring Draft' } }, { name: 'get_contest' }] },
  },
  {
    id: 'multi-category-then-publish',
    group: 'multi_tool',
    note: 'Settle what it is judged on, then publish it.',
    message: 'Add Presentation to Tapas Night and then publish it.',
    expect: {
      tools: [
        { name: 'add_category', arguments: { contest: 'Tapas Night', category: 'Presentation' } },
        { name: 'publish_contest' },
      ],
    },
  },
  {
    id: 'multi-pair-then-format',
    group: 'multi_tool',
    note: 'Pair two people, then say the contest is for couples — the order a host works in.',
    message: 'Pair Ana with Bob in Tapas Night, then make it a couples contest.',
    expect: {
      tools: [
        { name: 'set_partner', arguments: { contest: 'Tapas Night', person: 'Ana', partner: 'Bob' } },
        { name: 'set_format' },
      ],
    },
  },
];
