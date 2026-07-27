import { describe, expect, it } from 'vitest';
import { hostAssistantTools } from '../../src/host-assistant.js';

describe('hostAssistantTools', () => {
  it('exposes every catalog tool as an LLM tool definition with a JSON-schema input', async () => {
    const tools = await hostAssistantTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'close_contest',
      'create_draft',
      'find_contest',
      'get_contest',
      'get_draft',
      'get_results',
      'get_tally',
      'list_my_contests',
      'publish_contest',
      'trigger_reveal',
      'update_draft',
    ]);

    for (const tool of tools) {
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toMatchObject({ type: 'object' });
    }
  });

  it("derives get_contest's arguments from its schema, so the model knows what to send", async () => {
    const tools = await hostAssistantTools();
    const getContest = tools.find((tool) => tool.name === 'get_contest');
    expect(getContest?.inputSchema).toMatchObject({
      type: 'object',
      properties: { contestId: { type: 'string' } },
      required: ['contestId'],
    });
  });
});
