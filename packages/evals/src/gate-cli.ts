import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkRun, checkThresholds, formatGateResult, formatRunResult } from './gate.js';
import { THRESHOLDS_BY_SUITE, type EvalSuite } from './thresholds.js';

/**
 * `npm run eval:gate -- --suite <creation|host-assistant> --report <path>`
 *
 * The eval THRESHOLD gate (tasks.md 6.3). It reads a report produced by
 * `eval:creation` / `eval:host-assistant` and blocks (exit 1) only when a metric
 * drops below its committed floor (or above its ceiling). Report-based on
 * purpose: the gate is deterministic and needs no model, so it is unit-tested and
 * can gate any report — the live run that PRODUCES the report needs the model and
 * is the separate `eval:*` command (run out-of-band / on a model-equipped runner;
 * see docs/infra-generation.md 6.3).
 */

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const suite = flag('suite') as EvalSuite | undefined;
if (!suite || !(suite in THRESHOLDS_BY_SUITE)) {
  console.error(`--suite must be one of: ${Object.keys(THRESHOLDS_BY_SUITE).join(', ')}`);
  process.exit(2);
}

const reportPath = flag('report');
if (!reportPath) {
  console.error('--report <path> is required (a JSON report from eval:' + suite + ')');
  process.exit(2);
}

const resolved = resolve(reportPath);
let overall: Record<string, unknown>;
let cases: { error?: string }[];
try {
  const parsed = JSON.parse(await readFile(resolved, 'utf8')) as {
    overall?: Record<string, unknown>;
    cases?: { error?: string }[];
  };
  if (!parsed.overall || typeof parsed.overall !== 'object') {
    console.error(`Report ${resolved} has no "overall" metrics object`);
    process.exit(2);
  }
  overall = parsed.overall;
  cases = Array.isArray(parsed.cases) ? parsed.cases : [];
} catch (error) {
  console.error(`Could not read report ${resolved}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

console.log(`Eval threshold gate — ${suite}\n`);

/*
 * Did the run measure anything, before its numbers are believed? A ratio with no
 * denominator reads as 1, so a run in which every case errored scores 100% on
 * every metric and clears every floor. Checked first, and on its own, because no
 * threshold can catch it.
 */
const run = checkRun(cases);
const said = formatRunResult(run);
if (said) console.log(`${said}\n`);
if (!run.measured) process.exit(1);

const result = checkThresholds(overall, THRESHOLDS_BY_SUITE[suite]);
console.log(formatGateResult(result));

// Exit 1 (not 2) on a genuine threshold breach: CI reads this as "a metric
// regressed", distinct from a usage/IO error (exit 2).
process.exit(result.passed ? 0 : 1);
