import { describe, expect, it } from 'vitest';
import { KeywordStubLLMClient } from '../../../src/index.js';

const stub = new KeywordStubLLMClient();
const ask = (content: string) => stub.complete({ messages: [{ role: 'user', content }] });

describe('KeywordStubLLMClient (test-only assistant stub)', async () => {
  it('maps "start a draft called X" to a create_draft tool call', async () => {
    const out = await ask('Please start a draft called Summer Tapas');
    expect(out.toolCalls).toEqual([{ name: 'create_draft', arguments: { name: 'Summer Tapas' } }]);
  });

  it('maps "close <name>" to a close_contest tool call carrying that name', async () => {
    const out = await ask('close the contest Tapas Night');
    expect(out.toolCalls).toEqual([
      { name: 'close_contest', arguments: { contest: 'Tapas Night' } },
    ]);
  });

  it('maps "list my contests" to a list_my_contests tool call', async () => {
    const out = await ask('list my contests');
    expect(out.toolCalls).toEqual([{ name: 'list_my_contests', arguments: {} }]);
  });

  it('maps "find <name>" to a find_contest tool call carrying the name', async () => {
    const out = await ask('find Tapas Night');
    expect(out.toolCalls).toEqual([{ name: 'find_contest', arguments: { name: 'Tapas Night' } }]);
  });

  it('maps "details of <name>" to a get_contest_details tool call', async () => {
    const out = await ask('show me the details of Tapas Night');
    expect(out.toolCalls).toEqual([{ name: 'get_contest_details', arguments: { name: 'Tapas Night' } }]);
  });

  it('maps "who\'s in <name>" to a get_contest_details tool call', async () => {
    const out = await ask("who's in Tapas Night");
    expect(out.toolCalls).toEqual([{ name: 'get_contest_details', arguments: { name: 'Tapas Night' } }]);
  });

  it('maps "add <person> to <contest>" to an add_participant tool call', async () => {
    const out = await ask('add Carmen to Tapas Night');
    expect(out.toolCalls).toEqual([
      { name: 'add_participant', arguments: { contest: 'Tapas Night', participant: 'Carmen' } },
    ]);
  });

  it('maps "remove <person> from <contest>" to a remove_participant tool call', async () => {
    const out = await ask('remove Bob from Tapas Night');
    expect(out.toolCalls).toEqual([
      { name: 'remove_participant', arguments: { contest: 'Tapas Night', participant: 'Bob' } },
    ]);
  });

  it('asks to clarify when it recognises no action', async () => {
    const out = await ask('what can you do?');
    expect(out.toolCalls).toEqual([]);
    expect(out.text).toMatch(/which contest/i);
  });
});
