import type { LLMClient, LLMCompletion, LLMCompletionRequest, LLMToolCall } from '@tapas/shared';

export interface OpenAiCompatibleLLMClientOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  /**
   * Sampling controls, set per client rather than per request: a client is
   * either configured for reproducible output or it isn't. The eval harness
   * pins both so a trajectory reflects prompt changes rather than sampling
   * noise (design.md §11A.3). Omitted entirely when unset, so the provider's
   * own defaults apply and existing callers are unaffected.
   */
  readonly temperature?: number;
  readonly seed?: number;
  /**
   * How long to wait for a completion before giving up, in milliseconds.
   * Without one, a stalled connection blocks forever — a hung provider would
   * pin a host's request rather than failing it, and an eval run stops dead
   * mid-set. Observed for real: a local Ollama whose model had been unloaded
   * left a run blocked with no output and no error.
   */
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/** Thrown when a completion exceeds `timeoutMs`, so callers can tell a timeout from a transport error. */
export class LLMTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`);
    this.name = 'LLMTimeoutError';
  }
}

interface ChatCompletionResponse {
  readonly choices: ReadonlyArray<{
    readonly message: {
      readonly content: string | null;
      readonly tool_calls?: ReadonlyArray<{
        readonly function: { readonly name: string; readonly arguments: string };
      }>;
    };
  }>;
}

/**
 * Talks to any OpenAI-compatible `/chat/completions` endpoint — a local
 * Ollama by default, or a hosted provider that mirrors the same API shape.
 * The real model lives only here and in the eval harnesses (design.md
 * §11A.1) — every test uses a fake.
 */
export class OpenAiCompatibleLLMClient implements LLMClient {
  constructor(private readonly options: OpenAiCompatibleLLMClientOptions) {}

  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const response = await this.post(request, timeoutMs);

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
    }

    return parseCompletion((await response.json()) as ChatCompletionResponse);
  }

  private async post(request: LLMCompletionRequest, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(`${this.options.baseUrl}/chat/completions`, {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: request.messages,
          ...(this.options.temperature === undefined
            ? {}
            : { temperature: this.options.temperature }),
          ...(this.options.seed === undefined ? {} : { seed: this.options.seed }),
          ...(request.tools
            ? {
                tools: request.tools.map((tool) => ({
                  type: 'function',
                  function: {
                    name: tool.name,
                    description: tool.description,
                    parameters: tool.inputSchema,
                  },
                })),
              }
            : {}),
        }),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw new LLMTimeoutError(timeoutMs);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function parseCompletion(body: ChatCompletionResponse): LLMCompletion {
  const message = body.choices[0]?.message;
  const toolCalls: LLMToolCall[] = (message?.tool_calls ?? []).map((call) => ({
    name: call.function.name,
    arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
  }));

  return { text: message?.content ?? '', toolCalls };
}
