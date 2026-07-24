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
