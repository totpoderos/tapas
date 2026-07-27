import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG } from '../../src/tool-catalog.js';

describe('MCP tool catalog', () => {
  it('exposes get_contest as a read-only, host-scoped tool', () => {
    const getContest = TOOL_CATALOG.find((tool) => tool.name === 'get_contest');
    expect(getContest).toBeDefined();
    expect(getContest?.destructive).toBe(false);
    expect(getContest?.scope).toBe('host');
  });

  it('maps get_contest arguments to a GET on the contest, url-encoding the id', () => {
    const getContest = TOOL_CATALOG.find((tool) => tool.name === 'get_contest');
    expect(getContest?.toRequest({ contestId: 'abc/../123' })).toEqual({
      method: 'GET',
      path: '/contests/abc%2F..%2F123',
    });
  });

  it('maps list_my_contests to a GET on the contest list, with no arguments', () => {
    const listMyContests = TOOL_CATALOG.find((tool) => tool.name === 'list_my_contests');
    expect(listMyContests?.scope).toBe('host');
    expect(listMyContests?.destructive).toBe(false);
    expect(listMyContests?.inputSchema).toEqual({});
    expect(listMyContests?.toRequest({})).toEqual({ method: 'GET', path: '/contests' });
  });

  it('maps find_contest to a GET on the contest list filtered by name, url-encoding the name', () => {
    const findContest = TOOL_CATALOG.find((tool) => tool.name === 'find_contest');
    expect(findContest?.scope).toBe('host');
    expect(findContest?.destructive).toBe(false);
    expect(findContest?.toRequest({ name: 'Tapas Night & Co' })).toEqual({
      method: 'GET',
      path: '/contests?name=Tapas%20Night%20%26%20Co',
    });
  });

  it('maps get_draft to a GET on the draft', () => {
    const getDraft = TOOL_CATALOG.find((tool) => tool.name === 'get_draft');
    expect(getDraft?.scope).toBe('host');
    expect(getDraft?.destructive).toBe(false);
    expect(getDraft?.toRequest({ draftId: 'd1' })).toEqual({ method: 'GET', path: '/drafts/d1' });
  });

  it('maps get_tally to a GET on the contest tally', () => {
    const getTally = TOOL_CATALOG.find((tool) => tool.name === 'get_tally');
    expect(getTally?.scope).toBe('host');
    expect(getTally?.destructive).toBe(false);
    expect(getTally?.toRequest({ contestId: 'c1' })).toEqual({
      method: 'GET',
      path: '/contests/c1/tally',
    });
  });

  it('marks close_contest destructive and does not forward the confirmation token to the API', () => {
    const closeContest = TOOL_CATALOG.find((tool) => tool.name === 'close_contest');
    expect(closeContest?.destructive).toBe(true);
    expect(closeContest?.scope).toBe('host');
    // The confirmation token is a protocol concern — it must not leak into the API request.
    expect(closeContest?.toRequest({ contestId: 'c1', confirmationToken: 'anything' })).toEqual({
      method: 'POST',
      path: '/contests/c1/close',
    });
  });

  it('maps create_draft to a POST that carries the draft content as the body', () => {
    const createDraft = TOOL_CATALOG.find((tool) => tool.name === 'create_draft');
    expect(createDraft?.destructive).toBe(false);
    expect(createDraft?.toRequest({ name: 'Summer Tapas' })).toEqual({
      method: 'POST',
      path: '/drafts',
      body: { name: 'Summer Tapas' },
    });
  });

  it('maps update_draft to a PATCH that sends only the new name, not the id', () => {
    const updateDraft = TOOL_CATALOG.find((tool) => tool.name === 'update_draft');
    expect(updateDraft?.toRequest({ draftId: 'd1', name: 'Winter Tapas' })).toEqual({
      method: 'PATCH',
      path: '/drafts/d1',
      body: { name: 'Winter Tapas' },
    });
  });

  it('marks publish_contest destructive and does not forward the confirmation token', () => {
    const publishContest = TOOL_CATALOG.find((tool) => tool.name === 'publish_contest');
    expect(publishContest?.destructive).toBe(true);
    expect(publishContest?.toRequest({ draftId: 'd1', confirmationToken: 'x' })).toEqual({
      method: 'POST',
      path: '/drafts/d1/publish',
    });
  });

  it('marks trigger_reveal destructive and does not forward the confirmation token', () => {
    const triggerReveal = TOOL_CATALOG.find((tool) => tool.name === 'trigger_reveal');
    expect(triggerReveal?.destructive).toBe(true);
    expect(triggerReveal?.toRequest({ contestId: 'c1', confirmationToken: 'x' })).toEqual({
      method: 'POST',
      path: '/contests/c1/reveal',
    });
  });

  it('maps get_results to a GET on the contest results', () => {
    const getResults = TOOL_CATALOG.find((tool) => tool.name === 'get_results');
    expect(getResults?.destructive).toBe(false);
    expect(getResults?.toRequest({ contestId: 'c1' })).toEqual({
      method: 'GET',
      path: '/contests/c1/results',
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
