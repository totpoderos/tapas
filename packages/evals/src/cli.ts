import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { OpenAiCompatibleLLMClient } from '@tapas/api';
import { SEED_CASES } from '../cases/creation/seed.js';
import { parseCases } from './case.js';
import { runEval } from './run-eval.js';

/**
 * `npm run eval:creation` — runs the contest-creation eval against a real
 * model and writes a JSON report.
 *
 * This is deliberately NOT a Vitest test. Deterministic tests hard-gate the
 * build; evals are threshold-gated on a separate track (design.md §11A.3/4),
 * because a real model's output is not ours to make deterministic.
 */

function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const model = flag('model', process.env.LLM_MODEL ?? 'gemma4:e4b');
const baseUrl = flag('base-url', process.env.LLM_BASE_URL ?? 'http://localhost:11434/v1');
const temperature = Number(flag('temperature', '0'));
const seed = Number(flag('seed', '1'));
const outPath = resolve(flag('out', 'reports/creation-latest.json'));

const cases = parseCases(SEED_CASES);

// Hashing the case set makes a report self-describing: two reports are only
// comparable if this matches, which is what keeps a trajectory honest when
// cases are added or edited later.
const caseSetHash = createHash('sha256').update(JSON.stringify(cases)).digest('hex').slice(0, 12);

console.log(`Running ${cases.length} contest-creation cases against ${model} (${baseUrl})`);
console.log(`case-set ${caseSetHash}, temperature ${temperature}, seed ${seed}\n`);

const llmClient = new OpenAiCompatibleLLMClient({
  baseUrl,
  apiKey: process.env.LLM_API_KEY ?? '',
  model,
  temperature,
  seed,
});

const startedAt = new Date().toISOString();
const report = await runEval(cases, llmClient);

for (const result of report.cases) {
  const status = result.error ? 'ERROR' : 'ok';
  console.log(`[${status}] ${result.id} (${result.category})`);
  if (result.error) console.log(`    ${result.error}`);
  for (const [index, turn] of result.turns.entries()) {
    for (const note of turn.mismatches) console.log(`    turn ${index + 1}: ${note}`);
  }
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
console.log('\nOverall');
console.log(`  schema validity     ${pct(report.overall.schemaValidity)}`);
console.log(`  field accuracy      ${pct(report.overall.fieldAccuracy)}`);
console.log(`  missing-field recall ${pct(report.overall.missingFieldRecall)}`);
console.log(`  false-field rate    ${pct(report.overall.falseFieldRate)}`);
console.log(
  `  (of ${report.overallCounts.turns} turns: ${report.overallCounts.noToolCall} with no tool call, ` +
    `${report.overallCounts.fieldRejected} with a rejected field)`,
);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    { run: { startedAt, model, baseUrl, temperature, seed, caseSetHash }, ...report },
    null,
    2,
  ),
);
console.log(`\nReport written to ${outPath}`);
