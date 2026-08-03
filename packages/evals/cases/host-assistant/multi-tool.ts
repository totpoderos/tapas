import type { HostAssistantCaseInput } from '../../src/host-assistant/case.js';

/**
 * Multi-tool chaining (11) — the host asks for several things; the assistant
 * must propose every tool in the right order. Ground truth pins arguments only
 * where the host stated them (the first action of a chain); it does NOT pin an
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
  /*
   * The reported bug, as the host actually typed it. Everything they asked for
   * has to happen — and the one thing they did NOT say, what kind of contest it
   * is, must not be chosen for them: picking "solo" decides a high-stakes rule
   * the host never stated, which is what the extraction path refuses outright.
   *
   * Asking them for it is the panel's job, not the model's — this model returns
   * no text at all alongside tool calls (eleven of eleven multi-tool cases), so
   * an expectation about the words here would measure the adapter, not the
   * assistant. See the trajectory doc.
   */
  {
    id: 'multi-setup-without-saying-the-format',
    group: 'multi_tool',
    note: 'A whole contest set up in one message: do all of it, and invent no format.',
    message:
      'Create a new contest called Tapas. Add two categories: Taste and Originality. Add three participants: Carlos, Alba and Juan. Scoring range from 1 to 5 and allow duplicated scores.',
    /*
     * Every call is listed, repeats included, because chaining compares the
     * whole sequence — a case naming `add_category` once against a run that
     * rightly proposes it twice would read as a chaining failure. Arguments are
     * pinned only where one call can be told from another by name alone: a
     * repeated tool is matched by name, so pinning the second `add_category`
     * would score it against the first and measure ordering twice.
     */
    expect: {
      tools: [
        { name: 'create_draft', arguments: { name: 'Tapas' } },
        { name: 'add_category' },
        { name: 'add_category' },
        { name: 'add_participant' },
        { name: 'add_participant' },
        { name: 'add_participant' },
        { name: 'set_score_range', arguments: { contest: 'Tapas', min: 1, max: 5 } },
        { name: 'set_score_uniqueness', arguments: { contest: 'Tapas', uniquePerCategory: false } },
      ],
      forbidden: ['set_format'],
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
