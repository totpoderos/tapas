import { describe, expect, it } from 'vitest';
import { ExtractContestDraft } from '../../../../src/index.js';
import { FakeLLMClient } from './support.js';

function toolCallCompletion(args: Record<string, unknown>) {
  return { text: '', toolCalls: [{ name: 'propose_contest_draft', arguments: args }] };
}

describe('ExtractContestDraft', () => {
  it('extracts every field the model determined, tagged with its source', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        name: { value: 'Summer Tapas', source: 'host' },
        attribution: { value: 'per_person', source: 'host' },
        antiBias: { value: 'couples', source: 'host' },
        scoring: {
          value: {
            categories: [{ id: 'taste', name: 'Taste' }],
            range: { type: 'fixed', min: 1, max: 5 },
            uniquePerCategory: false,
          },
          source: 'llm_extracted',
        },
        participants: {
          value: [
            { id: 'ana', displayName: 'Ana' },
            { id: 'bob', displayName: 'Bob' },
          ],
          source: 'host',
        },
        closeRule: { value: { when: 'all_sent' }, source: 'llm_default' },
        revealStrategy: { value: { when: 'host_trigger' }, source: 'llm_default' },
        clarifications: [],
      }),
    );

    const outcome = await new ExtractContestDraft({ llmClient }).execute(
      'Summer Tapas, per person, couples barred, taste 1-5, Ana and Bob',
    );

    expect(outcome.draft.name).toEqual({ value: 'Summer Tapas', source: 'host' });
    expect(outcome.draft.closeRule).toEqual({ value: { when: 'all_sent' }, source: 'llm_default' });
    expect(outcome.clarifications).toEqual([]);
  });

  it('leaves out what the model could not determine and lists it as a clarification', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        name: { value: 'Summer Tapas', source: 'host' },
        clarifications: ['I could not tell who is participating — please list them.'],
      }),
    );

    const outcome = await new ExtractContestDraft({ llmClient }).execute('Summer Tapas');

    expect(outcome.draft.participants).toBeUndefined();
    expect(outcome.clarifications).toEqual([
      'I could not tell who is participating — please list them.',
    ]);
  });

  it('drops a high-stakes field the model defaulted, and adds a clarification instead', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        attribution: { value: 'per_person', source: 'llm_default' },
        clarifications: [],
      }),
    );

    const outcome = await new ExtractContestDraft({ llmClient }).execute('Some tapas contest');

    expect(outcome.draft.attribution).toBeUndefined();
    expect(outcome.clarifications).toEqual([
      "Please specify attribution explicitly — I can't default that for you.",
    ]);
  });

  it('reports a clarification when the model returns no tool call at all', async () => {
    const llmClient = new FakeLLMClient({ text: 'huh?', toolCalls: [] });

    const outcome = await new ExtractContestDraft({ llmClient }).execute('gibberish');

    expect(outcome.draft).toEqual({});
    expect(outcome.clarifications).toHaveLength(1);
  });

  it('keeps the fields that re-validate when one of them is unusable', async () => {
    // A real local model returned exactly this: a good name alongside a
    // `scoring` whose range came back as null.
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        name: { value: 'Summer Tapas 2026', source: 'llm_extracted' },
        scoring: {
          value: {
            categories: [{ id: 'taste', name: 'Taste' }],
            range: null,
            uniquePerCategory: false,
          },
          source: 'llm_extracted',
        },
        clarifications: ['Participants list was not provided.'],
      }),
    );

    const outcome = await new ExtractContestDraft({ llmClient }).execute('Summer Tapas 2026');

    expect(outcome.draft.name).toEqual({ value: 'Summer Tapas 2026', source: 'llm_extracted' });
    expect(outcome.draft.scoring).toBeUndefined();
    expect(outcome.clarifications).toEqual([
      'Participants list was not provided.',
      expect.stringContaining('the scoring rules'),
    ]);
  });

  it('treats a null field as one the model simply could not determine', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        name: { value: 'Summer Tapas', source: 'host' },
        attribution: null,
        participants: { value: null, source: 'llm_extracted' },
        clarifications: [],
      }),
    );

    const outcome = await new ExtractContestDraft({ llmClient }).execute('Summer Tapas');

    expect(outcome.draft).toEqual({ name: { value: 'Summer Tapas', source: 'host' } });
    expect(outcome.clarifications).toEqual([]);
  });

  it('ignores a field the model smuggled past the tool schema', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({
        name: { value: 'Summer Tapas', source: 'host' },
        hostId: 'someone-else',
        clarifications: [],
      }),
    );

    const outcome = await new ExtractContestDraft({ llmClient }).execute('Summer Tapas');

    expect(outcome.draft).toEqual({ name: { value: 'Summer Tapas', source: 'host' } });
    expect(outcome.clarifications).toEqual([]);
  });

  it('reports a clarification when the tool-call arguments fail re-validation', async () => {
    const llmClient = new FakeLLMClient(
      toolCallCompletion({ name: { value: 123, source: 'host' }, clarifications: [] }),
    );

    const outcome = await new ExtractContestDraft({ llmClient }).execute('adversarial input');

    expect(outcome.draft).toEqual({});
    expect(outcome.clarifications).toHaveLength(1);
  });
});
