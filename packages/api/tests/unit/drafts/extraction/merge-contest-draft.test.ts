import { describe, expect, it } from 'vitest';
import { MergeContestDraft, type MergeContestDraftInput } from '../../../../src/index.js';
import { FakeLLMClient } from './support.js';

function toolCallCompletion(args: Record<string, unknown>) {
  return { text: '', toolCalls: [{ name: 'propose_contest_draft', arguments: args }] };
}

const ANA_AND_BOB = {
  value: [
    { id: 'ana', displayName: 'Ana' },
    { id: 'bob', displayName: 'Bob' },
  ],
  source: 'host' as const,
};

const SCORING = {
  value: {
    categories: [{ id: 'taste', name: 'Taste' }],
    range: { type: 'fixed' as const, min: 1, max: 5 },
    uniquePerCategory: false,
  },
  source: 'host' as const,
};

function input(overrides: Partial<MergeContestDraftInput> = {}): MergeContestDraftInput {
  return {
    draft: { name: { value: 'Summer Tapas', source: 'host' } },
    clarifications: ['I could not tell who is participating — please list them.'],
    message: 'Ana and Bob are cooking.',
    ...overrides,
  };
}

describe('MergeContestDraft', () => {
  it('fills in the field the reply answers and clears the clarification', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        name: { value: 'Summer Tapas', source: 'host' },
        participants: ANA_AND_BOB,
        clarifications: [],
      }),
    );

    const outcome = await new MergeContestDraft({ llmClient }).execute(input());

    expect(outcome.draft.participants).toEqual(ANA_AND_BOB);
    expect(outcome.clarifications).toEqual([]);
  });

  it('keeps asking for whatever the reply did not answer', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        participants: ANA_AND_BOB,
        clarifications: ['How should dishes be scored?'],
      }),
    );

    const outcome = await new MergeContestDraft({ llmClient }).execute(
      input({
        clarifications: ['Who is participating?', 'How should dishes be scored?'],
      }),
    );

    expect(outcome.draft.participants).toEqual(ANA_AND_BOB);
    expect(outcome.clarifications).toEqual(['How should dishes be scored?']);
  });

  it('carries over a settled field the reply does not repeat', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({ participants: ANA_AND_BOB, clarifications: [] }),
    );

    const outcome = await new MergeContestDraft({ llmClient }).execute(input());

    expect(outcome.draft.name).toEqual({ value: 'Summer Tapas', source: 'host' });
  });

  it('lets the reply correct a field that was already set', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        name: { value: 'Winter Tapas', source: 'host' },
        clarifications: [],
      }),
    );

    const outcome = await new MergeContestDraft({ llmClient }).execute(
      input({ message: 'Actually call it Winter Tapas.' }),
    );

    expect(outcome.draft.name).toEqual({ value: 'Winter Tapas', source: 'host' });
  });

  it('drops a high-stakes field the model defaulted, and adds a clarification instead', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        format: { value: 'solo', source: 'llm_default' },
        clarifications: [],
      }),
    );

    const outcome = await new MergeContestDraft({ llmClient }).execute(input());

    expect(outcome.draft.format).toBeUndefined();
    expect(outcome.clarifications).toEqual([
      "Please specify the contest format explicitly — I can't default that for you.",
    ]);
  });

  it('drops a high-stakes field defaulted in the prior draft the caller sent back', async () => {
    const llmClient = new FakeLLMClient(toolCallCompletion({ clarifications: [] }));

    const outcome = await new MergeContestDraft({ llmClient }).execute(
      input({ draft: { format: { value: 'couples', source: 'llm_default' } } }),
    );

    expect(outcome.draft.format).toBeUndefined();
    expect(outcome.clarifications).toEqual([
      "Please specify the contest format explicitly — I can't default that for you.",
    ]);
  });

  it('asks about a defaulted high-stakes field once, not once per side of the merge', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        format: { value: 'solo', source: 'llm_default' },
        clarifications: [],
      }),
    );

    const outcome = await new MergeContestDraft({ llmClient }).execute(
      input({
        draft: { format: { value: 'couples', source: 'llm_default' } },
        clarifications: [],
      }),
    );

    expect(outcome.draft.format).toBeUndefined();
    expect(outcome.clarifications).toEqual([
      "Please specify the contest format explicitly — I can't default that for you.",
    ]);
  });

  it('keeps the draft and the open clarifications when the model returns no tool call', async () => {
    const llmClient = new FakeLLMClient({ text: 'huh?', toolCalls: [] });

    const outcome = await new MergeContestDraft({ llmClient }).execute(
      input({ draft: { name: { value: 'Summer Tapas', source: 'host' }, scoring: SCORING } }),
    );

    expect(outcome.draft.name).toEqual({ value: 'Summer Tapas', source: 'host' });
    expect(outcome.draft.scoring).toEqual(SCORING);
    expect(outcome.clarifications).toEqual([
      'I could not tell who is participating — please list them.',
      expect.stringContaining('could not work out'),
    ]);
  });

  it('keeps the prior value of a field the reply came back unusable for', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        name: { value: 123, source: 'host' },
        participants: ANA_AND_BOB,
        clarifications: [],
      }),
    );

    const outcome = await new MergeContestDraft({ llmClient }).execute(input());

    expect(outcome.draft.name).toEqual({ value: 'Summer Tapas', source: 'host' });
    expect(outcome.draft.participants).toEqual(ANA_AND_BOB);
    expect(outcome.clarifications).toEqual([expect.stringContaining('the contest name')]);
  });

  it('shows the assistant the prior draft and what is still open', async () => {
    const llmClient = new FakeLLMClient(toolCallCompletion({ clarifications: [] }));

    await new MergeContestDraft({ llmClient }).execute(input());

    const contents = llmClient.lastRequest!.messages.map((m) => m.content).join('\n');
    expect(contents).toContain('Summer Tapas');
    expect(contents).toContain('I could not tell who is participating');
    expect(contents).toContain('Ana and Bob are cooking.');
  });
});
