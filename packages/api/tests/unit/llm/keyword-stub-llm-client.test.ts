import { describe, expect, it } from 'vitest';
import { KeywordStubLLMClient } from '../../../src/index.js';

const stub = new KeywordStubLLMClient();
const ask = (content: string) => stub.complete({ messages: [{ role: 'user', content }] });

describe('KeywordStubLLMClient (test-only assistant stub)', () => {
  it('maps "start a draft called X" to a create_draft tool call', async () => {
    const out = await ask('Please start a draft called Summer Tapas');
    expect(out.toolCalls).toEqual([{ name: 'create_draft', arguments: { name: 'Summer Tapas' } }]);
  });

  it('maps "close ... <id>" to a close_contest tool call carrying that id', async () => {
    const id = '11111111-2222-3333-4444-555555555555';
    const out = await ask(`close the contest ${id}`);
    expect(out.toolCalls).toEqual([{ name: 'close_contest', arguments: { contestId: id } }]);
  });

  it('asks to clarify when it recognises no action', async () => {
    const out = await ask('what can you do?');
    expect(out.toolCalls).toEqual([]);
    expect(out.text).toMatch(/which contest/i);
  });
});
