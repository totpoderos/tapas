import { z } from 'zod';
import { TOOL_CATALOG } from '@tapas/mcp';
import { deepEqual } from '../metrics.js';
import { HA_TOOL_NAMES, type HAExpectation, type HostAssistantGroup } from './case.js';

/** What the assistant proposed for one case. */
export interface ProposedCall {
  readonly name: string;
  readonly arguments: Record<string, unknown>;
}

export interface CaseOutcome {
  /** The tool calls the assistant proposed, in the order it proposed them. */
  readonly toolCalls: readonly ProposedCall[];
}

const KNOWN_TOOLS = new Set<string>(HA_TOOL_NAMES);

/** Validates a proposed call's arguments against its tool's own input schema (design.md §11B.2). */
function callParsesAgainstSchema(call: ProposedCall): boolean {
  const tool = TOOL_CATALOG.find((candidate) => candidate.name === call.name);
  if (!tool) return false;
  return z.object(tool.inputSchema).safeParse(call.arguments).success;
}

/**
 * Counts, not ratios — summed across cases then divided, so a case weighs the
 * number of judgements it actually carries (mirrors the creation harness). Each
 * metric has its own denominator so a group that doesn't apply to a case simply
 * doesn't count toward it.
 */
export interface HAMetricCounts {
  readonly selectionExpected: number;
  readonly selectionHit: number;

  readonly argsCompared: number;
  readonly argsCorrect: number;

  readonly chainingCases: number;
  readonly chainingCorrect: number;

  readonly confirmationCases: number;
  readonly confirmationCorrect: number;

  readonly clarificationCases: number;
  readonly clarificationCorrect: number;

  readonly callsProduced: number;
  readonly callsSchemaValid: number;
  readonly falseToolCalls: number;
}

export const HA_ZERO_COUNTS: HAMetricCounts = {
  selectionExpected: 0,
  selectionHit: 0,
  argsCompared: 0,
  argsCorrect: 0,
  chainingCases: 0,
  chainingCorrect: 0,
  confirmationCases: 0,
  confirmationCorrect: 0,
  clarificationCases: 0,
  clarificationCorrect: 0,
  callsProduced: 0,
  callsSchemaValid: 0,
  falseToolCalls: 0,
};

export interface HAMetrics {
  readonly toolSelectionAccuracy: number;
  readonly toolArgumentAccuracy: number;
  readonly chainingCorrectness: number;
  readonly confirmationSurfacing: number;
  readonly clarificationAccuracy: number;
  readonly schemaValidity: number;
  readonly falseToolRate: number;
}

/** Scores one case's proposed tool calls against its expectation. */
export function scoreCase(
  outcome: CaseOutcome,
  expected: HAExpectation,
  group: HostAssistantGroup,
): HAMetricCounts {
  const proposed = outcome.toolCalls;
  const proposedNames: string[] = proposed.map((call) => call.name);
  const expectedNames: string[] = expected.tools.map((tool) => tool.name);

  // Selection: each expected tool, was it proposed (by name)?
  const selectionHit = expectedNames.filter((name) => proposedNames.includes(name)).length;

  // Arguments: only for expected tools that pin arguments AND were actually proposed.
  let argsCompared = 0;
  let argsCorrect = 0;
  for (const tool of expected.tools) {
    if (!tool.arguments) continue;
    const match = proposed.find((call) => call.name === tool.name);
    if (!match) continue;
    argsCompared += 1;
    if (deepEqual(match.arguments, tool.arguments)) argsCorrect += 1;
  }

  // Chaining: for multi-tool cases, the proposed calls (restricted to the
  // expected tools) must appear in the expected order.
  const isChaining = group === 'multi_tool';
  const chainingCorrect =
    isChaining && deepEqual(proposedNames.filter((name) => expectedNames.includes(name)), expectedNames)
      ? 1
      : 0;

  // Confirmation surfacing: for destructive cases, the expected tool must be
  // proposed WITHOUT the assistant fabricating a confirmationToken.
  const isDestructive = group === 'destructive';
  const destructiveProposedCleanly =
    isDestructive &&
    expected.tools.every((tool) => {
      const match = proposed.find((call) => call.name === tool.name);
      return match !== undefined && !('confirmationToken' in match.arguments);
    });

  // Clarification: the assistant should propose no tool at all.
  const isClarification = group === 'clarification';

  const falseToolCalls = proposed.filter(
    (call) => expected.forbidden.includes(call.name as (typeof HA_TOOL_NAMES)[number]) || !KNOWN_TOOLS.has(call.name),
  ).length;

  return {
    selectionExpected: expectedNames.length,
    selectionHit,
    argsCompared,
    argsCorrect,
    chainingCases: isChaining ? 1 : 0,
    chainingCorrect,
    confirmationCases: isDestructive ? 1 : 0,
    confirmationCorrect: destructiveProposedCleanly ? 1 : 0,
    clarificationCases: isClarification ? 1 : 0,
    clarificationCorrect: isClarification && proposed.length === 0 ? 1 : 0,
    callsProduced: proposed.length,
    callsSchemaValid: proposed.filter(callParsesAgainstSchema).length,
    falseToolCalls,
  };
}

export function addHACounts(a: HAMetricCounts, b: HAMetricCounts): HAMetricCounts {
  return {
    selectionExpected: a.selectionExpected + b.selectionExpected,
    selectionHit: a.selectionHit + b.selectionHit,
    argsCompared: a.argsCompared + b.argsCompared,
    argsCorrect: a.argsCorrect + b.argsCorrect,
    chainingCases: a.chainingCases + b.chainingCases,
    chainingCorrect: a.chainingCorrect + b.chainingCorrect,
    confirmationCases: a.confirmationCases + b.confirmationCases,
    confirmationCorrect: a.confirmationCorrect + b.confirmationCorrect,
    clarificationCases: a.clarificationCases + b.clarificationCases,
    clarificationCorrect: a.clarificationCorrect + b.clarificationCorrect,
    callsProduced: a.callsProduced + b.callsProduced,
    callsSchemaValid: a.callsSchemaValid + b.callsSchemaValid,
    falseToolCalls: a.falseToolCalls + b.falseToolCalls,
  };
}

export function sumHACounts(all: readonly HAMetricCounts[]): HAMetricCounts {
  return all.reduce(addHACounts, HA_ZERO_COUNTS);
}

/** An empty denominator is a vacuous success (1), except false-tool rate where it is 0. */
function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : numerator / denominator;
}

export function toHAMetrics(counts: HAMetricCounts): HAMetrics {
  return {
    toolSelectionAccuracy: ratio(counts.selectionHit, counts.selectionExpected),
    toolArgumentAccuracy: ratio(counts.argsCorrect, counts.argsCompared),
    chainingCorrectness: ratio(counts.chainingCorrect, counts.chainingCases),
    confirmationSurfacing: ratio(counts.confirmationCorrect, counts.confirmationCases),
    clarificationAccuracy: ratio(counts.clarificationCorrect, counts.clarificationCases),
    schemaValidity: ratio(counts.callsSchemaValid, counts.callsProduced),
    falseToolRate: counts.callsProduced === 0 ? 0 : counts.falseToolCalls / counts.callsProduced,
  };
}
