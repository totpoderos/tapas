/**
 * Provider-agnostic LLM interface. The concrete provider is chosen at
 * Phase 2/3; everything else depends only on this interface. Tool-calling
 * is a hard requirement of whichever provider backs it.
 */
export interface LLMMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/** A tool the model may call. `inputSchema` is a JSON Schema (additionalProperties:false). */
export interface LLMToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface LLMToolCall {
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface LLMCompletion {
  readonly text: string;
  readonly toolCalls: readonly LLMToolCall[];
}

export interface LLMCompletionRequest {
  readonly messages: readonly LLMMessage[];
  readonly tools?: readonly LLMToolDefinition[];
}

export interface LLMClient {
  complete(request: LLMCompletionRequest): Promise<LLMCompletion>;
}

/**
 * A no-op stub so the system boots before a provider is wired (Phase 0).
 * Returns an empty completion; replace with a real client in Phase 2/3.
 */
export class StubLLMClient implements LLMClient {
  async complete(_request: LLMCompletionRequest): Promise<LLMCompletion> {
    return { text: '', toolCalls: [] };
  }
}
