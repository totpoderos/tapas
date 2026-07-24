import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { checkThresholds, formatGateResult } from './gate.js';
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
try {
  const parsed = JSON.parse(await readFile(resolved, 'utf8')) as { overall?: Record<string, unknown> };
  if (!parsed.overall || typeof parsed.overall !== 'object') {
    console.error(`Report ${resolved} has no "overall" metrics object`);
    process.exit(2);
  }
  overall = parsed.overall;
} catch (error) {
  console.error(`Could not read report ${resolved}: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const result = checkThresholds(overall, THRESHOLDS_BY_SUITE[suite]);
console.log(`Eval threshold gate — ${suite}\n`);
console.log(formatGateResult(result));

// Exit 1 (not 2) on a genuine threshold breach: CI reads this as "a metric
// regressed", distinct from a usage/IO error (exit 2).
process.exit(result.passed ? 0 : 1);
