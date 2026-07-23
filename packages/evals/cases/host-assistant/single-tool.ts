import type { HostAssistantCaseInput } from '../../src/host-assistant/case.js';

/**
 * Single-tool selection (10) — the host asks for one thing; the assistant must
 * pick the right (non-destructive) tool and fill its arguments from what the
 * host said. Ground truth pins the arguments because they are all recoverable
 * from the message (an id or a name the host stated).
 */
export const SINGLE_TOOL_CASES: HostAssistantCaseInput[] = [
  {
    id: 'single-get-contest',
    group: 'single_tool',
    note: 'A plain read of a named contest.',
    message: 'Show me contest c1.',
    expect: { tools: [{ name: 'get_contest', arguments: { contestId: 'c1' } }] },
  },
  {
    id: 'single-get-contest-status-phrasing',
    group: 'single_tool',
    note: 'Same tool, worded as a status question rather than "show".',
    message: "What's the current state of contest c5?",
    expect: { tools: [{ name: 'get_contest', arguments: { contestId: 'c5' } }] },
  },
  {
    id: 'single-get-draft',
    group: 'single_tool',
    note: 'Reading a draft the host is still preparing, by id.',
    message: 'Open my draft d3 so I can see where it stands.',
    expect: { tools: [{ name: 'get_draft', arguments: { draftId: 'd3' } }] },
  },
  {
    id: 'single-get-tally',
    group: 'single_tool',
    note: 'The live tally of a running contest.',
    message: 'How many people have sent their votes in contest c1?',
    expect: { tools: [{ name: 'get_tally', arguments: { contestId: 'c1' } }] },
  },
  {
    id: 'single-get-tally-pending-phrasing',
    group: 'single_tool',
    note: 'Tally again, asked as "who still needs to vote".',
    message: 'Who still needs to vote in contest c2?',
    expect: { tools: [{ name: 'get_tally', arguments: { contestId: 'c2' } }] },
  },
  {
    id: 'single-get-results',
    group: 'single_tool',
    note: 'Final results of a contest by id.',
    message: 'Show me the final results for contest c9.',
    expect: { tools: [{ name: 'get_results', arguments: { contestId: 'c9' } }] },
  },
  {
    id: 'single-get-results-winner-phrasing',
    group: 'single_tool',
    note: 'Results again, asked as "who won".',
    message: 'Who won contest c4?',
    expect: { tools: [{ name: 'get_results', arguments: { contestId: 'c4' } }] },
  },
  {
    id: 'single-create-draft',
    group: 'single_tool',
    note: 'Starting a new draft with just a name.',
    message: 'Start a new contest draft called "Autumn Tapas".',
    expect: { tools: [{ name: 'create_draft', arguments: { name: 'Autumn Tapas' } }] },
  },
  {
    id: 'single-create-draft-office',
    group: 'single_tool',
    note: 'Create a draft, name given in a different phrasing.',
    message: 'Set up a draft for our office bake-off — call it "Office Bake-off".',
    expect: { tools: [{ name: 'create_draft', arguments: { name: 'Office Bake-off' } }] },
  },
  {
    id: 'single-update-draft-rename',
    group: 'single_tool',
    note: 'Renaming an existing draft — both the id and the new name are stated.',
    message: 'Rename draft d2 to "Winter Cook-off".',
    expect: { tools: [{ name: 'update_draft', arguments: { draftId: 'd2', name: 'Winter Cook-off' } }] },
  },
];
