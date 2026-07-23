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

  it('gives every tool a name, a description and an input schema', () => {
    for (const tool of TOOL_CATALOG) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeTypeOf('object');
    }
  });
});
