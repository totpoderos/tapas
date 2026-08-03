import { afterEach, describe, expect, it, vi } from 'vitest';
import { LLMTimeoutError, OpenAiCompatibleLLMClient } from '../../../src/index.js';

const OPTIONS = { baseUrl: 'http://llm.test/v1', apiKey: '', model: 'test-model' };

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const A_COMPLETION = { choices: [{ message: { content: 'hi', tool_calls: [] } }] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('OpenAiCompatibleLLMClient', async () => {
  it('gives up on a request that never completes, rather than hanging forever', async () => {
    // A stalled connection previously blocked an eval run indefinitely, with
    // no output and no error — the run looked identical to a slow model.
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          );
        }),
    );

    const client = new OpenAiCompatibleLLMClient({ ...OPTIONS, timeoutMs: 20 });

    await expect(client.complete({ messages: [] })).rejects.toBeInstanceOf(LLMTimeoutError);
  });

  it('does not time out a request that answers in time', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(A_COMPLETION));

    const client = new OpenAiCompatibleLLMClient({ ...OPTIONS, timeoutMs: 5_000 });

    await expect(client.complete({ messages: [] })).resolves.toEqual({ text: 'hi', toolCalls: [] });
  });

  it('surfaces a transport failure as itself, not as a timeout', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('connection refused'));

    const client = new OpenAiCompatibleLLMClient(OPTIONS);

    await expect(client.complete({ messages: [] })).rejects.toThrow('connection refused');
  });

  it('sends sampling controls only when they are configured', async () => {
    // A fresh Response per call — a body can only be consumed once.
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => jsonResponse(A_COMPLETION));

    await new OpenAiCompatibleLLMClient(OPTIONS).complete({ messages: [] });
    const plain = JSON.parse(String(fetchMock.mock.calls[0]![1]!.body));
    expect(plain).not.toHaveProperty('temperature');
    expect(plain).not.toHaveProperty('seed');

    await new OpenAiCompatibleLLMClient({ ...OPTIONS, temperature: 0, seed: 7 }).complete({
      messages: [],
    });
    const pinned = JSON.parse(String(fetchMock.mock.calls[1]![1]!.body));
    expect(pinned.temperature).toBe(0);
    expect(pinned.seed).toBe(7);
  });

  it('parses a tool call out of the response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { function: { name: 'propose_contest_draft', arguments: '{"clarifications":[]}' } },
              ],
            },
          },
        ],
      }),
    );

    const completion = await new OpenAiCompatibleLLMClient(OPTIONS).complete({ messages: [] });

    expect(completion.toolCalls).toEqual([
      { name: 'propose_contest_draft', arguments: { clarifications: [] } },
    ]);
  });
});
