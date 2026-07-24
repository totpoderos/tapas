export {
  CATEGORIES,
  EvalCaseSchema,
  EvalTurnSchema,
  ExpectationSchema,
  FIELD_NAMES,
  parseCases,
} from './case.js';
export type { Category, EvalCase, EvalTurn, Expectation, FieldName } from './case.js';

export { asksAbout, fieldsAskedAbout } from './clarification-match.js';

export {
  ZERO_COUNTS,
  addCounts,
  deepEqual,
  scoreTurn,
  sumCounts,
  toMetrics,
} from './metrics.js';
export type { MetricCounts, Metrics, TurnOutcome } from './metrics.js';

export { runEval } from './run-eval.js';
export type { CaseResult, EvalReport, TurnResult } from './run-eval.js';

// Host-assistant (tool-use) eval — design.md §10.2.
export {
  HA_GROUPS,
  HA_TOOL_NAMES,
  HostAssistantCaseSchema,
  HAExpectationSchema,
  parseHostAssistantCases,
} from './host-assistant/case.js';
export type {
  HostAssistantCase,
  HostAssistantCaseInput,
  HostAssistantGroup,
  HAExpectation,
  HaToolName,
} from './host-assistant/case.js';
export {
  HA_ZERO_COUNTS,
  addHACounts,
  scoreCase,
  sumHACounts,
  toHAMetrics,
} from './host-assistant/metrics.js';
export type { CaseOutcome, HAMetricCounts, HAMetrics, ProposedCall } from './host-assistant/metrics.js';
export { runHostAssistantEval } from './host-assistant/run-eval.js';
export type { HACaseResult, HAEvalReport } from './host-assistant/run-eval.js';

// Threshold gate (tasks.md 6.3) — committed thresholds + the pure pass/fail check.
export { checkThresholds, formatGateResult } from './gate.js';
export type { GateResult, GateRow } from './gate.js';
export {
  CREATION_THRESHOLDS,
  HOST_ASSISTANT_THRESHOLDS,
  THRESHOLDS_BY_SUITE,
} from './thresholds.js';
export type { EvalSuite, Threshold, ThresholdKind } from './thresholds.js';
