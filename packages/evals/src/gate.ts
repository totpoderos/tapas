import type { Threshold } from './thresholds.js';

/**
 * The eval threshold gate (tasks.md 6.3). Pure: given a report's `overall`
 * metrics and a suite's committed thresholds, decide pass/fail per metric so the
 * caller can print a trajectory table and set an exit code. Kept free of I/O and
 * of the model so it is unit-testable without a run.
 */

export interface GateRow {
  readonly metric: string;
  readonly label: string;
  readonly kind: Threshold['kind'];
  readonly bound: number;
  /** The metric's value in the report, or undefined if the report lacks it. */
  readonly value: number | undefined;
  readonly passed: boolean;
}

export interface GateResult {
  readonly rows: readonly GateRow[];
  readonly passed: boolean;
}

/**
 * A missing metric FAILS closed — a report that does not carry a gated metric is
 * treated as a breach, never a silent pass, so a shape change can't slip a
 * regression through.
 */
export function checkThresholds(
  metrics: Record<string, unknown>,
  thresholds: readonly Threshold[],
): GateResult {
  const rows = thresholds.map((t): GateRow => {
    const raw = metrics[t.metric];
    const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
    const passed =
      value === undefined ? false : t.kind === 'floor' ? value >= t.bound : value <= t.bound;
    return { metric: t.metric, label: t.label, kind: t.kind, bound: t.bound, value, passed };
  });
  return { rows, passed: rows.every((r) => r.passed) };
}

/**
 * One case as a report records it: scored, or errored with a reason.
 *
 * A report's cases carry much more than this — the outcome, the counts, the
 * mismatches — and none of it is the run check's business. `id` is named
 * because a case has one and because a lone optional field makes this a weak
 * type that no real case object would satisfy.
 */
export interface ReportedCase {
  readonly id?: string;
  readonly error?: string;
}

export interface RunResult {
  readonly total: number;
  readonly scored: number;
  readonly errored: number;
  /** False when the run scored nothing — its metrics say nothing and must not be read as a pass. */
  readonly measured: boolean;
}

/**
 * Whether a run measured anything at all, before its numbers are believed.
 *
 * A ratio with no denominator is reported as 1, which is right for a case that
 * had nothing to compare and wrong for a run that compared nothing: every case
 * erroring produced 100% on every metric, "of 0 turns", and a passing gate. That
 * is how a CI runner with no model configured returned a green tick over 25
 * ERROR lines.
 *
 * The per-metric behaviour is deliberately left alone — a clarification case
 * expecting no tools should not drag the aggregate down. The judgement that was
 * missing is about the run, so it is made here.
 *
 * A partial outage is not refused: what ran was really measured. It is counted
 * instead, because "97%" over three of fifty cases is a number somebody will
 * otherwise read as ninety-seven per cent.
 */
export function checkRun(cases: readonly ReportedCase[]): RunResult {
  const total = cases.length;
  const errored = cases.filter((one) => one.error !== undefined).length;
  const scored = total - errored;
  return { total, scored, errored, measured: scored > 0 };
}

/** What to say about the run itself. Empty when every case was scored — then there is nothing to add. */
export function formatRunResult(result: RunResult): string {
  if (!result.measured) {
    return (
      `  Gate FAILED — nothing was measured: ${result.scored} of ${result.total} cases scored, ` +
      `${result.errored} errored.\n  Metrics over an empty run read as perfect; they are not.`
    );
  }
  if (result.errored > 0) {
    return `  NOTE  ${result.errored} of ${result.total} cases errored — the metrics below cover the other ${result.scored}.`;
  }
  return '';
}

const pct = (v: number | undefined): string => (v === undefined ? '  --  ' : `${(v * 100).toFixed(1)}%`);

/** Renders the gate result as a trajectory table (value vs floor/ceiling). */
export function formatGateResult(result: GateResult): string {
  const lines = result.rows.map((r) => {
    const cmp = r.kind === 'floor' ? '>=' : '<=';
    const status = r.passed ? 'PASS' : 'FAIL';
    return `  ${status}  ${r.label.padEnd(24)} ${pct(r.value).padStart(7)}  (${cmp} ${pct(r.bound)})`;
  });
  lines.push(result.passed ? '\n  Gate PASSED' : '\n  Gate FAILED — a metric breached its committed threshold');
  return lines.join('\n');
}
