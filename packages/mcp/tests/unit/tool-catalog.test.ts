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

  it('gives every tool a name, a description and an input schema', () => {
    for (const tool of TOOL_CATALOG) {
      expect(tool.name).toMatch(/^[a-z_]+$/);
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeTypeOf('object');
    }
  });
});
