import { describe, expect, it } from 'vitest';
import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '@tapas/shared';
import { runHostAssistantEval } from '../../../src/host-assistant/run-eval.js';
import type { HostAssistantCase } from '../../../src/host-assistant/case.js';

/** Returns a canned completion per user message, keyed by the message text. */
class ScriptedLLMClient implements LLMClient {
  constructor(private readonly byMessage: Record<string, LLMCompletion>) {}
  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    const lastUser = [...request.messages].reverse().find((message) => message.role === 'user');
    return this.byMessage[lastUser?.content ?? ''] ?? { text: '', toolCalls: [] };
  }
}

const CASES: HostAssistantCase[] = [
  {
    id: 'tally',
    group: 'single_tool',
    message: 'tally for c1',
    expect: { tools: [{ name: 'get_tally', arguments: { contestId: 'c1' } }], forbidden: [], mustNotSelfConfirm: false },
  },
  {
    id: 'ambiguous',
    group: 'clarification',
    message: 'close it',
    expect: { tools: [], forbidden: [], mustNotSelfConfirm: false },
  },
];

describe('runHostAssistantEval', () => {
  it('drives the production assistant and scores each case against ground truth', async () => {
    const llm = new ScriptedLLMClient({
      'tally for c1': { text: '', toolCalls: [{ name: 'get_tally', arguments: { contestId: 'c1' } }] },
      'close it': { text: 'Which contest do you mean?', toolCalls: [] },
    });

    const report = await runHostAssistantEval(CASES, llm);

    expect(report.overall.toolSelectionAccuracy).toBe(1);
    expect(report.overall.clarificationAccuracy).toBe(1);
    expect(report.byGroup.single_tool?.toolArgumentAccuracy).toBe(1);
    expect(report.cases.every((result) => result.mismatches.length === 0)).toBe(true);
  });

  it('records a mismatch when the assistant proposes the wrong tool', async () => {
    const llm = new ScriptedLLMClient({
      'tally for c1': { text: '', toolCalls: [{ name: 'get_contest', arguments: { contestId: 'c1' } }] },
    });

    const report = await runHostAssistantEval([CASES[0]!], llm);

    expect(report.overall.toolSelectionAccuracy).toBe(0);
    expect(report.cases[0]?.mismatches).toContain('did not propose get_tally');
  });
});
