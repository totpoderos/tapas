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
