import type { LLMClient, LLMCompletion, LLMCompletionRequest, LLMToolCall } from '@tapas/shared';

export interface OpenAiCompatibleLLMClientOptions {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
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
    const response = await fetch(`${this.options.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.options.apiKey ? { Authorization: `Bearer ${this.options.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: request.messages,
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

    if (!response.ok) {
      throw new Error(`LLM request failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const message = body.choices[0]?.message;
    const toolCalls: LLMToolCall[] = (message?.tool_calls ?? []).map((call) => ({
      name: call.function.name,
      arguments: JSON.parse(call.function.arguments) as Record<string, unknown>,
    }));

    return { text: message?.content ?? '', toolCalls };
  }
}
