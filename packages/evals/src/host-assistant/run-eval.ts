import { HostAssistant, hostAssistantTools } from '@tapas/mcp';
import type { LLMClient } from '@tapas/shared';
import type { HostAssistantCase } from './case.js';
import {
  scoreCase,
  sumHACounts,
  toHAMetrics,
  HA_ZERO_COUNTS,
  type CaseOutcome,
  type HAMetricCounts,
  type HAMetrics,
} from './metrics.js';

export interface HACaseResult {
  readonly id: string;
  readonly group: HostAssistantCase['group'];
  readonly outcome: CaseOutcome;
  readonly counts: HAMetricCounts;
  /** Plain-language notes on what diverged from ground truth, so a regression reads without a rerun. */
  readonly mismatches: readonly string[];
  readonly error?: string;
}

export interface HAEvalReport {
  readonly cases: readonly HACaseResult[];
  readonly overall: HAMetrics;
  readonly overallCounts: HAMetricCounts;
  readonly byGroup: Record<string, HAMetrics>;
}

export interface RunHAEvalOptions {
  readonly onCaseComplete?: (result: HACaseResult, done: number, total: number) => void;
}

/**
 * Runs the host-assistant eval by driving the **production `HostAssistant`**
 * (its system prompt and the real MCP tool catalog), not a reimplementation —
 * what the host's chat panel would send the model is what gets scored. Each
 * case is one host message; the assistant's proposed tool calls are the
 * outcome. A case that throws (a transport error, say) is recorded on that case
 * rather than failing the run.
 */
export async function runHostAssistantEval(
  cases: readonly HostAssistantCase[],
  llmClient: LLMClient,
  options: RunHAEvalOptions = {},
): Promise<HAEvalReport> {
  const assistant = new HostAssistant({ llmClient, tools: await hostAssistantTools() });

  const results: HACaseResult[] = [];
  for (const evalCase of cases) {
    results.push(await runCase(evalCase, assistant));
    options.onCaseComplete?.(results[results.length - 1]!, results.length, cases.length);
  }

  const overallCounts = sumHACounts(results.map((result) => result.counts));
  const byGroup: Record<string, HAMetrics> = {};
  for (const group of new Set(results.map((result) => result.group))) {
    byGroup[group] = toHAMetrics(
      sumHACounts(results.filter((result) => result.group === group).map((result) => result.counts)),
    );
  }

  return { cases: results, overall: toHAMetrics(overallCounts), overallCounts, byGroup };
}

async function runCase(evalCase: HostAssistantCase, assistant: HostAssistant): Promise<HACaseResult> {
  try {
    const completion = await assistant.respond([{ role: 'user', content: evalCase.message }]);
    const outcome: CaseOutcome = {
      toolCalls: completion.toolCalls.map((call) => ({ name: call.name, arguments: call.arguments })),
      text: completion.text,
    };
    const counts = scoreCase(outcome, evalCase.expect, evalCase.group);
    return {
      id: evalCase.id,
      group: evalCase.group,
      outcome,
      counts,
      mismatches: describeMismatches(evalCase, outcome),
    };
  } catch (error) {
    return {
      id: evalCase.id,
      group: evalCase.group,
      outcome: { toolCalls: [] },
      counts: HA_ZERO_COUNTS,
      mismatches: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function describeMismatches(evalCase: HostAssistantCase, outcome: CaseOutcome): string[] {
  const notes: string[] = [];
  const proposedNames = outcome.toolCalls.map((call) => call.name);
  const expectedNames = evalCase.expect.tools.map((tool) => tool.name);

  for (const name of expectedNames) {
    if (!proposedNames.includes(name)) notes.push(`did not propose ${name}`);
  }
  for (const call of outcome.toolCalls) {
    if (evalCase.expect.forbidden.includes(call.name as never)) notes.push(`proposed forbidden ${call.name}`);
  }
  if (evalCase.group === 'clarification' && outcome.toolCalls.length > 0) {
    notes.push(`expected a clarification but proposed ${proposedNames.join(', ')}`);
  }
  if (evalCase.expect.mustNotSelfConfirm) {
    for (const call of outcome.toolCalls) {
      if ('confirmationToken' in call.arguments) notes.push(`self-confirmed ${call.name}`);
    }
  }
  return notes;
}
