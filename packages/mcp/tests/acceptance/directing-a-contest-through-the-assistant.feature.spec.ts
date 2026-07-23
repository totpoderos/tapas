import { fileURLToPath } from 'node:url';
import { describeFeature, loadFeature } from '@amiceli/vitest-cucumber';
import { expect } from 'vitest';
import { HostAssistant, hostAssistantTools } from '../../src/host-assistant.js';
import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '@tapas/shared';

const feature = await loadFeature(
  fileURLToPath(new URL('./directing-a-contest-through-the-assistant.feature', import.meta.url)),
);

/** A canned LLM that records the request it was given, so we can check what the assistant offered it. */
class FakeLLMClient implements LLMClient {
  lastRequest: LLMCompletionRequest | undefined;
  constructor(private readonly completion: LLMCompletion) {}
  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    this.lastRequest = request;
    return this.completion;
  }
}

describeFeature(feature, ({ Scenario }) => {
  Scenario('The assistant proposes an action for a clear request', ({ Given, When, Then }) => {
    let llm: FakeLLMClient;
    let assistant: HostAssistant;
    let result: LLMCompletion;

    Given('a host assistant with the contest tools available', async () => {
      // The model, given the tools, chooses to close the contest.
      llm = new FakeLLMClient({
        text: '',
        toolCalls: [{ name: 'close_contest', arguments: { contestId: 'c1' } }],
      });
      assistant = new HostAssistant({ llmClient: llm, tools: await hostAssistantTools() });
    });
    When('the host asks it to close their contest', async () => {
      result = await assistant.respond([{ role: 'user', content: 'Please close contest c1.' }]);
    });
    Then('the assistant proposes closing that contest', () => {
      expect(result.toolCalls).toEqual([{ name: 'close_contest', arguments: { contestId: 'c1' } }]);
    });
  });

  Scenario('The assistant asks for clarification when a request is ambiguous', ({ Given, When, Then }) => {
    let assistant: HostAssistant;
    let result: LLMCompletion;

    Given('a host assistant with the contest tools available', async () => {
      // Faced with an ambiguous request, the model replies in words and calls no tool.
      const llm = new FakeLLMClient({ text: 'Which contest do you mean?', toolCalls: [] });
      assistant = new HostAssistant({ llmClient: llm, tools: await hostAssistantTools() });
    });
    When('the host asks for something it cannot act on without more detail', async () => {
      result = await assistant.respond([{ role: 'user', content: 'Close it.' }]);
    });
    Then('the assistant asks the host to clarify instead of proposing an action', () => {
      expect(result.toolCalls).toEqual([]);
      expect(result.text).toBe('Which contest do you mean?');
    });
  });

  Scenario('The assistant is offered every contest tool to choose from', ({ Given, When, Then }) => {
    let llm: FakeLLMClient;
    let assistant: HostAssistant;

    Given('a host assistant with the contest tools available', async () => {
      llm = new FakeLLMClient({ text: '', toolCalls: [] });
      assistant = new HostAssistant({ llmClient: llm, tools: await hostAssistantTools() });
    });
    When('the host sends any request', async () => {
      await assistant.respond([{ role: 'user', content: 'What can you do?' }]);
    });
    Then('the assistant lets the model choose from all of the contest tools', () => {
      const offered = (llm.lastRequest?.tools ?? []).map((tool) => tool.name).sort();
      expect(offered).toEqual([
        'close_contest',
        'create_draft',
        'get_contest',
        'get_draft',
        'get_results',
        'get_tally',
        'publish_contest',
        'trigger_reveal',
        'update_draft',
      ]);
      // and the host-assistant instructions lead the conversation
      expect(llm.lastRequest?.messages[0]?.role).toBe('system');
    });
  });
});
