import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG, parseToolArguments } from '../../src/tool-catalog.js';

const toolNamed = (name: string) => TOOL_CATALOG.find((tool) => tool.name === name)!;

/**
 * A model's arguments for `create_draft`, with only the scoring varied — the
 * rest is the same well-formed draft every time, so what each case asserts is
 * the scoring and nothing else.
 */
const draftScoring = (scoring: unknown) => ({
  name: 'Tapas',
  format: 'solo',
  participants: [{ displayName: 'Carlos' }],
  scoring: { categories: [{ id: 'c1', name: 'Taste' }], uniquePerCategory: false, ...(scoring as object) },
});

describe('MCP tool catalog', async () => {
  it('exposes get_contest as a read-only, host-scoped tool', async () => {
    const getContest = TOOL_CATALOG.find((tool) => tool.name === 'get_contest');
    expect(getContest).toBeDefined();
    expect(getContest?.destructive).toBe(false);
    expect(getContest?.scope).toBe('host');
  });

  it('maps get_contest arguments to a GET by name, url-encoding the name', async () => {
    const getContest = TOOL_CATALOG.find((tool) => tool.name === 'get_contest');
    expect(getContest?.toRequest({ contest: 'abc/../123' })).toEqual({
      method: 'GET',
      path: '/contests/by-name?name=abc%2F..%2F123',
    });
  });

  /*
   * The rule the whole surface now rests on. A tool that still took an id would
   * make the model ask the host for something they have never been shown.
   */
  it('names the contest, never identifies it, on every host-facing tool', () => {
    const addressed = TOOL_CATALOG.filter((tool) => 'contest' in tool.inputSchema);
    expect(addressed.map((t) => t.name).sort()).toEqual([
      'add_category',
      'add_participant',
      'close_contest',
      'delete_contest',
      'get_contest',
      'get_draft',
      'get_results',
      'get_tally',
      'publish_contest',
      'remove_category',
      'remove_participant',
      'rename_contest',
      'set_format',
      'set_partner',
      'set_score_range',
      'set_score_uniqueness',
      'trigger_reveal',
    ]);
    for (const tool of TOOL_CATALOG) {
      expect(Object.keys(tool.inputSchema)).not.toContain('contestId');
      expect(Object.keys(tool.inputSchema)).not.toContain('draftId');
    }
  });

  it('maps list_my_contests to a GET on the contest list, with no arguments', async () => {
    const listMyContests = TOOL_CATALOG.find((tool) => tool.name === 'list_my_contests');
    expect(listMyContests?.scope).toBe('host');
    expect(listMyContests?.destructive).toBe(false);
    expect(listMyContests?.inputSchema).toEqual({});
    expect(listMyContests?.toRequest({})).toEqual({ method: 'GET', path: '/contests' });
  });

  it('maps find_contest to a GET on the contest list filtered by name, url-encoding the name', async () => {
    const findContest = TOOL_CATALOG.find((tool) => tool.name === 'find_contest');
    expect(findContest?.scope).toBe('host');
    expect(findContest?.destructive).toBe(false);
    expect(findContest?.toRequest({ name: 'Tapas Night & Co' })).toEqual({
      method: 'GET',
      path: '/contests?name=Tapas%20Night%20%26%20Co',
    });
  });

  it('maps get_contest_details to a GET on the details endpoint, url-encoding the name', async () => {
    const getContestDetails = TOOL_CATALOG.find((tool) => tool.name === 'get_contest_details');
    expect(getContestDetails?.scope).toBe('host');
    expect(getContestDetails?.destructive).toBe(false);
    expect(getContestDetails?.toRequest({ name: 'Tapas Night' })).toEqual({
      method: 'GET',
      path: '/contests/details?name=Tapas%20Night',
    });
  });

  it('maps add_participant to a POST with the contest + participant, non-destructive', async () => {
    const addParticipant = TOOL_CATALOG.find((tool) => tool.name === 'add_participant');
    expect(addParticipant?.scope).toBe('host');
    expect(addParticipant?.destructive).toBe(false);
    expect(addParticipant?.toRequest({ contest: 'Tapas Night', participant: 'Carmen' })).toEqual({
      method: 'POST',
      path: '/drafts/participants',
      body: { contest: 'Tapas Night', participant: 'Carmen' },
    });
  });

  it('marks remove_participant destructive and maps it to a DELETE with url-encoded params', async () => {
    const removeParticipant = TOOL_CATALOG.find((tool) => tool.name === 'remove_participant');
    expect(removeParticipant?.scope).toBe('host');
    expect(removeParticipant?.destructive).toBe(true);
    expect(removeParticipant?.toRequest({ contest: 'Tapas Night', participant: 'Bob' })).toEqual({
      method: 'DELETE',
      path: '/drafts/participants?contest=Tapas%20Night&participant=Bob',
    });
  });

  it('maps get_draft to a GET on the draft by name', async () => {
    const getDraft = TOOL_CATALOG.find((tool) => tool.name === 'get_draft');
    expect(getDraft?.scope).toBe('host');
    expect(getDraft?.destructive).toBe(false);
    expect(getDraft?.toRequest({ contest: 'Tapas Night' })).toEqual({
      method: 'GET',
      path: '/drafts/by-name?name=Tapas%20Night',
    });
  });

  it('maps get_tally to a GET on the contest tally', async () => {
    const getTally = TOOL_CATALOG.find((tool) => tool.name === 'get_tally');
    expect(getTally?.scope).toBe('host');
    expect(getTally?.destructive).toBe(false);
    expect(getTally?.toRequest({ contest: 'Tapas Night' })).toEqual({
      method: 'GET',
      path: '/contests/by-name/tally?name=Tapas%20Night',
    });
  });

  it('marks close_contest destructive and does not forward the confirmation token to the API', async () => {
    const closeContest = TOOL_CATALOG.find((tool) => tool.name === 'close_contest');
    expect(closeContest?.destructive).toBe(true);
    expect(closeContest?.scope).toBe('host');
    // The confirmation token is a protocol concern — it must not leak into the API request.
    expect(closeContest?.toRequest({ contest: 'Tapas Night', confirmationToken: 'anything' })).toEqual({
      method: 'POST',
      path: '/contests/by-name/close',
      body: { contest: 'Tapas Night' },
    });
  });

  it('maps create_draft to a POST that carries the draft content as the body', async () => {
    const createDraft = TOOL_CATALOG.find((tool) => tool.name === 'create_draft');
    expect(createDraft?.destructive).toBe(false);
    expect(createDraft?.toRequest({ name: 'Summer Tapas' })).toEqual({
      method: 'POST',
      path: '/drafts',
      body: { name: 'Summer Tapas' },
    });
  });

  /*
   * The reported bug: a host who said "scoring range from 1 to 5" got "the
   * details didn't look right (scoring.range: Invalid input)" and no contest at
   * all. Everything they said had arrived — the model wrote the range the way
   * `set_score_range` takes one, `{min, max}`, with the bounds as the strings
   * that spell them. Two shapes for one thing, and the host paid for it.
   */
  it('reads a range a model wrote as a bare min/max pair as a fixed range', () => {
    const parsed = parseToolArguments(toolNamed('create_draft'), draftScoring({ range: { min: 1, max: 5 } }));
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.args.scoring).toMatchObject({ range: { type: 'fixed', min: 1, max: 5 } });
  });

  it('reads bounds a model wrote as the strings that spell them', () => {
    const parsed = parseToolArguments(toolNamed('create_draft'), draftScoring({ range: { min: '1', max: '5' } }));
    expect(parsed.ok).toBe(true);
    expect(parsed.ok && parsed.args.scoring).toMatchObject({ range: { type: 'fixed', min: 1, max: 5 } });
  });

  it('reads a range with no bounds at all as one the contest works out for itself', () => {
    const parsed = parseToolArguments(toolNamed('create_draft'), draftScoring({ range: {} }));
    expect(parsed.ok && parsed.args.scoring).toMatchObject({ range: { type: 'auto' } });
  });

  /*
   * Half a range is not a range. Reading it as either kind would settle a
   * scoring rule the host never stated, which is the one thing the assistant
   * may not do — so it is refused and the host is asked.
   */
  it('refuses a range given only one bound rather than guessing which kind it is', () => {
    const parsed = parseToolArguments(toolNamed('create_draft'), draftScoring({ range: { min: 1 } }));
    expect(parsed.ok).toBe(false);
  });

  it('still refuses a bound that is not a number at all', () => {
    for (const min of ['high', true, null, [1]]) {
      expect(parseToolArguments(toolNamed('create_draft'), draftScoring({ range: { min, max: 5 } })).ok).toBe(false);
    }
  });

  it('leaves a range the model tagged itself exactly as it wrote it', () => {
    const parsed = parseToolArguments(
      toolNamed('create_draft'),
      draftScoring({ range: { type: 'fixed', min: 1, max: 5 } }),
    );
    expect(parsed.ok && parsed.args.scoring).toMatchObject({ range: { type: 'fixed', min: 1, max: 5 } });
  });

  /** The sibling path, which a model reaches for just as often — the same tolerance. */
  it('reads set_score_range bounds written as strings', () => {
    const parsed = parseToolArguments(toolNamed('set_score_range'), { contest: 'Tapas', min: '1', max: '5' });
    expect(parsed.ok && parsed.args).toMatchObject({ contest: 'Tapas', min: 1, max: 5 });
  });

  it('maps rename_contest to a PATCH carrying the old name and the new one', async () => {
    const updateDraft = TOOL_CATALOG.find((tool) => tool.name === 'rename_contest');
    expect(updateDraft?.toRequest({ contest: 'Tapas Night', name: 'Winter Tapas' })).toEqual({
      method: 'PATCH',
      path: '/drafts/by-name',
      body: { contest: 'Tapas Night', name: 'Winter Tapas' },
    });
  });

  it('marks publish_contest destructive and does not forward the confirmation token', async () => {
    const publishContest = TOOL_CATALOG.find((tool) => tool.name === 'publish_contest');
    expect(publishContest?.destructive).toBe(true);
    expect(publishContest?.toRequest({ contest: 'Tapas Night', confirmationToken: 'x' })).toEqual({
      method: 'POST',
      path: '/drafts/by-name/publish',
      body: { contest: 'Tapas Night' },
    });
  });

  it('marks trigger_reveal destructive and does not forward the confirmation token', async () => {
    const triggerReveal = TOOL_CATALOG.find((tool) => tool.name === 'trigger_reveal');
    expect(triggerReveal?.destructive).toBe(true);
    expect(triggerReveal?.toRequest({ contest: 'Tapas Night', confirmationToken: 'x' })).toEqual({
      method: 'POST',
      path: '/contests/by-name/reveal',
      body: { contest: 'Tapas Night' },
    });
  });

  it('marks delete_contest destructive and does not forward the confirmation token', async () => {
    const deleteContest = TOOL_CATALOG.find((tool) => tool.name === 'delete_contest');
    expect(deleteContest?.destructive).toBe(true);
    expect(deleteContest?.toRequest({ contest: 'Tapas Night', confirmationToken: 'x' })).toEqual({
      method: 'DELETE',
      path: '/contests/by-name?name=Tapas%20Night',
    });
  });

  it("carries the typed name through as the API's confirm parameter", async () => {
    const deleteContest = TOOL_CATALOG.find((tool) => tool.name === 'delete_contest');
    expect(
      deleteContest?.toRequest({ contest: 'Summer Tapas', confirmName: 'Summer Tapas' }),
    ).toEqual({
      method: 'DELETE',
      path: '/contests/by-name?name=Summer%20Tapas&confirm=Summer%20Tapas',
    });
  });

  it('encodes a contest name that would otherwise break out of the query', async () => {
    const deleteContest = TOOL_CATALOG.find((tool) => tool.name === 'delete_contest');
    expect(
      deleteContest?.toRequest({ contest: 'c 1', confirmName: 'A&B=C?D' }),
    ).toEqual({
      method: 'DELETE',
      path: '/contests/by-name?name=c%201&confirm=A%26B%3DC%3FD',
    });
  });

  it('maps get_results to a GET on the contest results', async () => {
    const getResults = TOOL_CATALOG.find((tool) => tool.name === 'get_results');
    expect(getResults?.destructive).toBe(false);
    expect(getResults?.toRequest({ contest: 'Tapas Night' })).toEqual({
      method: 'GET',
      path: '/contests/by-name/results?name=Tapas%20Night',
    });
  });

  it('gives every tool a name, a description and an input schema', () => {
    for (const tool of TOOL_CATALOG) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeTypeOf('object');
    }
  });
});
