import { describe, expect, it } from 'vitest';
import { StubLLMClient } from '../../../src/index.js';

describe('StubLLMClient', () => {
  it('returns an empty completion so the system can boot without a provider', async () => {
    const client = new StubLLMClient();
    const result = await client.complete({ messages: [{ role: 'user', content: 'hi' }] });

    expect(result.text).toBe('');
    expect(result.toolCalls).toEqual([]);
  });
});
