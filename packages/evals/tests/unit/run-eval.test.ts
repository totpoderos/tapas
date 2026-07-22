import { describe, expect, it } from 'vitest';
import type { LLMClient, LLMCompletion, LLMCompletionRequest } from '@tapas/shared';
import { parseCases, runEval, type EvalCase } from '../../src/index.js';
import { SEED_CASES } from '../../cases/creation/seed.js';

/** Replays scripted completions in order, so a multi-turn case can be driven deterministically. */
class ScriptedLLMClient implements LLMClient {
  readonly requests: LLMCompletionRequest[] = [];
  private next = 0;

  constructor(private readonly script: readonly LLMCompletion[]) {}

  async complete(request: LLMCompletionRequest): Promise<LLMCompletion> {
    this.requests.push(request);
    return this.script[this.next++] ?? { text: '', toolCalls: [] };
  }
}

function proposes(args: Record<string, unknown>): LLMCompletion {
  return { text: '', toolCalls: [{ name: 'propose_contest_draft', arguments: args }] };
}

const NAME_ONLY_CASE: EvalCase = {
  id: 'name-only',
  category: 'simple',
  turns: [
    {
      message: 'Contest called Summer Tapas.',
      expect: { fields: { name: 'Summer Tapas' }, clarifiesAbout: ['participants'], absent: [] },
    },
  ],
};

describe('runEval', () => {
  it('scores a perfect single-turn case at full marks', async () => {
    const llm = new ScriptedLLMClient([
      proposes({
        name: { value: 'Summer Tapas', source: 'host' },
        clarifications: ['Who is participating?'],
      }),
    ]);

    const report = await runEval([NAME_ONLY_CASE], llm);

    expect(report.overall.schemaValidity).toBe(1);
    expect(report.overall.fieldAccuracy).toBe(1);
    expect(report.overall.missingFieldRecall).toBe(1);
    expect(report.overall.falseFieldRate).toBe(0);
  });

  it('feeds the previous turn back in, so a merge turn sees the earlier draft', async () => {
    const twoTurn: EvalCase = {
      id: 'two-turn',
      category: 'partial_clarify',
      turns: [
        {
          message: 'Contest called Winter Tapas.',
          expect: { fields: { name: 'Winter Tapas' }, clarifiesAbout: ['participants'], absent: [] },
        },
        {
          message: 'Ana is cooking.',
          expect: { fields: { name: 'Winter Tapas' }, clarifiesAbout: [], absent: [] },
        },
      ],
    };
    const llm = new ScriptedLLMClient([
      proposes({
        name: { value: 'Winter Tapas', source: 'host' },
        clarifications: ['Who is participating?'],
      }),
      // The merge turn returns only participants — the name must be carried over.
      proposes({
        participants: { value: [{ id: 'ana', displayName: 'Ana' }], source: 'host' },
        clarifications: [],
      }),
    ]);

    const report = await runEval([twoTurn], llm);

    const secondTurnPrompt = llm.requests[1]!.messages.map((m) => m.content).join('\n');
    expect(secondTurnPrompt).toContain('Winter Tapas');
    expect(report.cases[0]!.turns[1]!.outcome.fields.name).toBe('Winter Tapas');
    expect(report.overall.fieldAccuracy).toBe(1);
  });

  it('records a turn with no tool call as a schema failure, not a crash', async () => {
    const llm = new ScriptedLLMClient([{ text: 'sorry?', toolCalls: [] }]);

    const report = await runEval([NAME_ONLY_CASE], llm);

    expect(report.overall.schemaValidity).toBe(0);
    expect(report.overallCounts.noToolCall).toBe(1);
    expect(report.cases[0]!.turns[0]!.mismatches).toContain('no usable tool call');
  });

  it('records a field that failed re-validation separately from a missing tool call', async () => {
    const llm = new ScriptedLLMClient([
      proposes({
        name: { value: 'Summer Tapas', source: 'host' },
        scoring: { value: { categories: [], range: null, uniquePerCategory: false }, source: 'host' },
        clarifications: ['Who is participating?'],
      }),
    ]);

    const report = await runEval([NAME_ONLY_CASE], llm);

    expect(report.overallCounts.noToolCall).toBe(0);
    expect(report.overallCounts.fieldRejected).toBe(1);
    expect(report.cases[0]!.turns[0]!.mismatches).toContain('scoring: failed re-validation');
  });

  it('explains a wrong value in the mismatches, so a report can be read without a rerun', async () => {
    const llm = new ScriptedLLMClient([
      proposes({
        name: { value: 'Winter Tapas', source: 'host' },
        clarifications: ['Who is participating?'],
      }),
    ]);

    const report = await runEval([NAME_ONLY_CASE], llm);

    expect(report.cases[0]!.turns[0]!.mismatches).toContain(
      'name: expected "Summer Tapas", got "Winter Tapas"',
    );
  });

  it('reports a case that throws as an error rather than failing the whole run', async () => {
    const exploding: LLMClient = {
      async complete() {
        throw new Error('connection refused');
      },
    };

    const report = await runEval([NAME_ONLY_CASE], exploding);

    expect(report.cases[0]!.error).toBe('connection refused');
  });

  it('breaks metrics down by category', async () => {
    const llm = new ScriptedLLMClient([
      proposes({ name: { value: 'Summer Tapas', source: 'host' }, clarifications: ['Who is participating?'] }),
      { text: '', toolCalls: [] },
    ]);
    const adversarial: EvalCase = { ...NAME_ONLY_CASE, id: 'adv', category: 'adversarial' };

    const report = await runEval([NAME_ONLY_CASE, adversarial], llm);

    expect(report.byCategory.simple!.schemaValidity).toBe(1);
    expect(report.byCategory.adversarial!.schemaValidity).toBe(0);
  });
});

describe('the seed case set', () => {
  it('is valid against the case schema', () => {
    expect(() => parseCases(SEED_CASES)).not.toThrow();
  });

  it('covers single-turn, multi-turn and adversarial shapes', () => {
    const cases = parseCases(SEED_CASES);
    expect(cases.some((c) => c.turns.length === 1)).toBe(true);
    expect(cases.some((c) => c.turns.length > 1)).toBe(true);
    expect(cases.some((c) => c.category === 'adversarial')).toBe(true);
  });
});
