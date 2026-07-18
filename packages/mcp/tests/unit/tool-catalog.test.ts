import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG } from '../../src/tool-catalog.js';

describe('MCP tool catalog', () => {
  it('is empty in Phase 0 (tools land in Phase 4)', () => {
    expect(TOOL_CATALOG).toEqual([]);
  });
});
