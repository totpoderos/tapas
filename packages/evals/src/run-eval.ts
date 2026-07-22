import {
  ExtractContestDraft,
  MergeContestDraft,
  type ExtractedFields,
  type MergeContestDraftInput,
} from '@tapas/api';
import type { LLMClient } from '@tapas/shared';
import { FIELD_NAMES, type EvalCase, type FieldName } from './case.js';
import { asksAbout } from './clarification-match.js';
import {
  addCounts,
  deepEqual,
  scoreTurn,
  sumCounts,
  toMetrics,
  ZERO_COUNTS,
  type MetricCounts,
  type Metrics,
  type TurnOutcome,
} from './metrics.js';

export interface TurnResult {
  readonly message: string;
  readonly outcome: TurnOutcome;
  readonly counts: MetricCounts;
  /** Field-by-field verdicts, so a regression can be read without re-running. */
  readonly mismatches: readonly string[];
}

export interface CaseResult {
  readonly id: string;
  readonly category: EvalCase['category'];
  readonly turns: readonly TurnResult[];
  readonly counts: MetricCounts;
  readonly metrics: Metrics;
  /** Set when the case threw (a transport error, say) rather than scoring badly. */
  readonly error?: string;
}

export interface RunEvalOptions {
  /** Called as each case finishes, so a long run can report progress. */
  readonly onCaseComplete?: (result: CaseResult, done: number, total: number) => void;
}

export interface EvalReport {
  readonly cases: readonly CaseResult[];
  readonly overall: Metrics;
  readonly overallCounts: MetricCounts;
  readonly byCategory: Record<string, Metrics>;
}

/**
 * Runs the eval by driving the **production use cases**, not a reimplementation
 * of them: whatever the host's client would get is what gets scored, prompts
 * and guards included. Turn 1 extracts; every later turn merges the previous
 * turn's draft and clarifications back in, exactly as the two-phase chat does
 * (design.md §8).
 */
export async function runEval(
  cases: readonly EvalCase[],
  llmClient: LLMClient,
  options: RunEvalOptions = {},
): Promise<EvalReport> {
  const extract = new ExtractContestDraft({ llmClient });
  const merge = new MergeContestDraft({ llmClient });

  const results: CaseResult[] = [];
  for (const evalCase of cases) {
    const result = await runCase(evalCase, extract, merge);
    results.push(result);
    // A full run is tens of real model calls and takes many minutes; reporting
    // only at the end makes it indistinguishable from a hang.
    options.onCaseComplete?.(result, results.length, cases.length);
  }

  const overallCounts = sumCounts(results.map((r) => r.counts));
  const byCategory: Record<string, Metrics> = {};
  for (const category of new Set(results.map((r) => r.category))) {
    byCategory[category] = toMetrics(
      sumCounts(results.filter((r) => r.category === category).map((r) => r.counts)),
    );
  }

  return { cases: results, overall: toMetrics(overallCounts), overallCounts, byCategory };
}

async function runCase(
  evalCase: EvalCase,
  extract: ExtractContestDraft,
  merge: MergeContestDraft,
): Promise<CaseResult> {
  const turns: TurnResult[] = [];
  let draft: ExtractedFields = {};
  let clarifications: readonly string[] = [];

  try {
    for (const [index, turn] of evalCase.turns.entries()) {
      const result =
        index === 0
          ? await extract.execute(turn.message)
          : await merge.execute({
              draft,
              clarifications: [...clarifications],
              message: turn.message,
            } satisfies MergeContestDraftInput);

      draft = result.draft;
      clarifications = result.clarifications;

      const outcome: TurnOutcome = {
        fields: stripSources(result.draft),
        clarifications: [...result.clarifications],
        noToolCall: result.diagnostics.noToolCall,
        rejectedFields: result.diagnostics.rejectedFields as readonly FieldName[],
      };

      turns.push({
        message: turn.message,
        outcome,
        counts: scoreTurn(outcome, turn.expect),
        mismatches: describeMismatches(outcome, turn.expect),
      });
    }
  } catch (error) {
    return {
      id: evalCase.id,
      category: evalCase.category,
      turns,
      counts: sumCounts(turns.map((t) => t.counts)),
      metrics: toMetrics(sumCounts(turns.map((t) => t.counts))),
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const counts = turns.map((t) => t.counts).reduce(addCounts, ZERO_COUNTS);
  return { id: evalCase.id, category: evalCase.category, turns, counts, metrics: toMetrics(counts) };
}

/** Ground truth asserts values, so the `{value, source}` wrapper is unwrapped before comparison. */
function stripSources(draft: ExtractedFields): Partial<Record<FieldName, unknown>> {
  const out: Partial<Record<FieldName, unknown>> = {};
  for (const field of FIELD_NAMES) {
    const entry = (draft as Record<string, { value: unknown } | undefined>)[field];
    if (entry !== undefined) out[field] = entry.value;
  }
  return out;
}

function describeMismatches(
  outcome: TurnOutcome,
  expected: EvalCase['turns'][number]['expect'],
): string[] {
  const notes: string[] = [];
  if (outcome.noToolCall) notes.push('no usable tool call');
  for (const field of outcome.rejectedFields) notes.push(`${field}: failed re-validation`);
  for (const field of Object.keys(expected.fields) as FieldName[]) {
    if (outcome.fields[field] === undefined) {
      notes.push(`${field}: missing`);
    } else if (!deepEqual(outcome.fields[field], expected.fields[field])) {
      notes.push(
        `${field}: expected ${JSON.stringify(expected.fields[field])}, got ${JSON.stringify(outcome.fields[field])}`,
      );
    }
  }
  for (const field of expected.clarifiesAbout) {
    if (!asksAbout(outcome.clarifications, field)) notes.push(`${field}: never asked about`);
  }
  for (const field of expected.absent) {
    if (outcome.fields[field] !== undefined) notes.push(`${field}: present but forbidden`);
  }
  return notes;
}
