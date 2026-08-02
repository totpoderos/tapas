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
    message: 'Show me Tapas Night.',
    expect: { tools: [{ name: 'get_contest', arguments: { contest: 'Tapas Night' } }] },
  },
  {
    id: 'single-get-contest-status-phrasing',
    group: 'single_tool',
    note: 'Same tool, worded as a status question rather than "show".',
    message: "What's the current state of Summer Tapas?",
    expect: { tools: [{ name: 'get_contest', arguments: { contest: 'Summer Tapas' } }] },
  },
  {
    id: 'single-get-draft',
    group: 'single_tool',
    note: 'Reading a draft the host is still preparing, named the way they say it.',
    message: 'Open my draft Autumn Tapas so I can see where it stands.',
    expect: { tools: [{ name: 'get_draft', arguments: { contest: 'Autumn Tapas' } }] },
  },
  {
    id: 'single-get-tally',
    group: 'single_tool',
    note: 'The live tally of a running contest.',
    message: 'How many people have sent their votes in Tapas Night?',
    expect: { tools: [{ name: 'get_tally', arguments: { contest: 'Tapas Night' } }] },
  },
  {
    id: 'single-get-tally-pending-phrasing',
    group: 'single_tool',
    note: 'Tally again, asked as "who still needs to vote".',
    message: 'Who still needs to vote in Sunday Roast?',
    expect: { tools: [{ name: 'get_tally', arguments: { contest: 'Sunday Roast' } }] },
  },
  {
    id: 'single-get-results',
    group: 'single_tool',
    note: 'Final results of a contest, named.',
    message: 'Show me the final results for Winter Feast.',
    expect: { tools: [{ name: 'get_results', arguments: { contest: 'Winter Feast' } }] },
  },
  {
    id: 'single-get-results-winner-phrasing',
    group: 'single_tool',
    note: 'Results again, asked as "who won".',
    message: 'Who won Autumn Feast?',
    expect: { tools: [{ name: 'get_results', arguments: { contest: 'Autumn Feast' } }] },
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
    message: 'Rename Harvest Supper to "Winter Cook-off".',
    expect: { tools: [{ name: 'rename_contest', arguments: { contest: 'Harvest Supper', name: 'Winter Cook-off' } }] },
  },
  {
    id: 'single-list-contests',
    group: 'single_tool',
    note: 'The whole list, with no contest named — nothing to resolve.',
    message: 'What contests do I have?',
    expect: { tools: [{ name: 'list_my_contests', arguments: {} }] },
  },
  {
    id: 'single-find-by-name',
    group: 'single_tool',
    note: 'Asking whether a name exists, rather than asking to read what is inside it.',
    message: 'Do I have a contest called Tapas Night?',
    expect: { tools: [{ name: 'find_contest', arguments: { name: 'Tapas Night' } }] },
  },
  {
    id: 'single-contest-details',
    group: 'single_tool',
    note: 'Who is taking part — the details view, not the plain contest read.',
    message: "Who's taking part in Tapas Night?",
    expect: { tools: [{ name: 'get_contest_details', arguments: { name: 'Tapas Night' } }] },
  },
  {
    id: 'single-add-participant',
    group: 'single_tool',
    note: 'Adding somebody to a draft, both names said plainly.',
    message: 'Add Carmen to Tapas Night.',
    expect: { tools: [{ name: 'add_participant', arguments: { contest: 'Tapas Night', participant: 'Carmen' } }] },
  },
  {
    id: 'single-add-category',
    group: 'single_tool',
    note: 'What a contest is judged on, added one at a time.',
    message: 'Judge Tapas Night on Presentation too.',
    expect: { tools: [{ name: 'add_category', arguments: { contest: 'Tapas Night', category: 'Presentation' } }] },
  },
  {
    id: 'single-score-range',
    group: 'single_tool',
    note: 'A fixed range, both bounds stated by the host.',
    message: 'Score Tapas Night from 1 to 10.',
    expect: { tools: [{ name: 'set_score_range', arguments: { contest: 'Tapas Night', min: 1, max: 10 } }] },
  },
  {
    id: 'single-score-range-auto',
    group: 'single_tool',
    note: 'A ranking asked for in words — the range is worked out, so NEITHER bound is sent.',
    message: 'Let Tapas Night work out its own score range from the number of dishes.',
    expect: { tools: [{ name: 'set_score_range', arguments: { contest: 'Tapas Night' } }] },
  },
  {
    id: 'single-score-uniqueness',
    group: 'single_tool',
    note: 'Scores that may not repeat, asked for as "a different score for each".',
    message: 'In Tapas Night every dish should get a different score in each category.',
    expect: {
      tools: [{ name: 'set_score_uniqueness', arguments: { contest: 'Tapas Night', uniquePerCategory: true } }],
    },
  },
  {
    id: 'single-set-format',
    group: 'single_tool',
    note: 'The format said the way a host says it, not by its internal name.',
    message: 'Tapas Night is a contest where couples cook together.',
    expect: { tools: [{ name: 'set_format', arguments: { contest: 'Tapas Night', format: 'couples' } }] },
  },
  {
    id: 'single-set-partner',
    group: 'single_tool',
    note: 'Pairing two people, both named — the pairing is one asking, not two.',
    message: 'Pair Ana with Bob in Tapas Night.',
    expect: {
      tools: [{ name: 'set_partner', arguments: { contest: 'Tapas Night', person: 'Ana', partner: 'Bob' } }],
    },
  },
];
