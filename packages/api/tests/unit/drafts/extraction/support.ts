import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '../../../../src/index.js';

/** Returns a canned completion — the real model lives only in the eval harnesses (design.md §11A.1). */
export class FakeLLMClient implements LLMClient {
  lastRequest: LLMCompletionRequest | undefined;

  constructor(private readonly completion: LLMCompletion) {}

  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    this.lastRequest = request;
    return this.completion;
  }
}
