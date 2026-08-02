import { describe, expect, it } from 'vitest';
import { hostAssistantTools } from '../../src/host-assistant.js';

describe('hostAssistantTools', () => {
  it('exposes every catalog tool as an LLM tool definition with a JSON-schema input', async () => {
    const tools = await hostAssistantTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'add_category',
      'add_participant',
      'close_contest',
      'create_draft',
      'delete_contest',
      'find_contest',
      'get_contest',
      'get_contest_details',
      'get_draft',
      'get_results',
      'get_tally',
      'list_my_contests',
      'publish_contest',
      'remove_category',
      'remove_participant',
      'rename_contest',
      'set_score_range',
      'set_score_uniqueness',
      'trigger_reveal',
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
      properties: { contest: { type: 'string' } },
      required: ['contest'],
    });
  });
});
