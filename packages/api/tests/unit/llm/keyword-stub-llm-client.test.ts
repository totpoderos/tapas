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

  it('maps "list my contests" to a list_my_contests tool call', async () => {
    const out = await ask('list my contests');
    expect(out.toolCalls).toEqual([{ name: 'list_my_contests', arguments: {} }]);
  });

  it('maps "find <name>" to a find_contest tool call carrying the name', async () => {
    const out = await ask('find Tapas Night');
    expect(out.toolCalls).toEqual([{ name: 'find_contest', arguments: { name: 'Tapas Night' } }]);
  });

  it('asks to clarify when it recognises no action', async () => {
    const out = await ask('what can you do?');
    expect(out.toolCalls).toEqual([]);
    expect(out.text).toMatch(/which contest/i);
  });
});
