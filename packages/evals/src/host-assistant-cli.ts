import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { OpenAiCompatibleLLMClient } from '@tapas/api';
import { HOST_ASSISTANT_CASES } from '../cases/host-assistant/index.js';
import { parseHostAssistantCases } from './host-assistant/case.js';
import { runHostAssistantEval } from './host-assistant/run-eval.js';

/**
 * `npm run eval:host-assistant` — runs the host-assistant (tool-use) eval
 * against a real model and writes a JSON report. Like the creation eval this is
 * deliberately NOT a Vitest test: the harness's own unit tests hard-gate, the
 * real-model run is threshold-gated on its own track (design.md §11A.3/4).
 */
function flag(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? (process.argv[index + 1] ?? fallback) : fallback;
}

const model = flag('model', process.env.LLM_MODEL ?? 'gemma4:e4b');
const baseUrl = flag('base-url', process.env.LLM_BASE_URL ?? 'http://localhost:11434/v1');
const temperature = Number(flag('temperature', '0'));
const seed = Number(flag('seed', '1'));
const outPath = resolve(flag('out', 'reports/host-assistant-latest.json'));

const groupFilter = flag('group', '');
const caseFilter = flag('case', '');

const allCases = parseHostAssistantCases(HOST_ASSISTANT_CASES);
const cases = allCases.filter(
  (c) => (!groupFilter || c.group === groupFilter) && (!caseFilter || c.id.includes(caseFilter)),
);

if (cases.length === 0) {
  console.error(`No cases matched (group=${groupFilter || '*'}, case=${caseFilter || '*'})`);
  process.exit(1);
}

const caseSetHash = createHash('sha256').update(JSON.stringify(allCases)).digest('hex').slice(0, 12);
const scope = cases.length === allCases.length ? 'full set' : `filtered from ${allCases.length}`;
console.log(`Running ${cases.length} host-assistant cases (${scope}) against ${model} (${baseUrl})`);
console.log(`case-set ${caseSetHash}, temperature ${temperature}, seed ${seed}\n`);

const llmClient = new OpenAiCompatibleLLMClient({
  baseUrl,
  apiKey: process.env.LLM_API_KEY ?? '',
  model,
  temperature,
  seed,
});

const startedAt = new Date().toISOString();
const report = await runHostAssistantEval(cases, llmClient, {
  onCaseComplete: (result, done, total) => {
    const status = result.error ? 'ERROR' : result.mismatches.length === 0 ? 'ok' : 'diff';
    console.log(`[${done}/${total}] ${status.padEnd(5)} ${result.id} (${result.group})`);
    if (result.error) console.log(`    ${result.error}`);
    for (const note of result.mismatches) console.log(`    ${note}`);
  },
});

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
console.log('\nOverall');
console.log(`  tool-selection accuracy  ${pct(report.overall.toolSelectionAccuracy)}`);
console.log(`  tool-argument accuracy   ${pct(report.overall.toolArgumentAccuracy)}`);
console.log(`  chaining correctness     ${pct(report.overall.chainingCorrectness)}`);
console.log(`  confirmation surfacing   ${pct(report.overall.confirmationSurfacing)}`);
console.log(`  clarification accuracy   ${pct(report.overall.clarificationAccuracy)}`);
console.log(`  schema validity          ${pct(report.overall.schemaValidity)}`);
console.log(`  false-tool rate          ${pct(report.overall.falseToolRate)}`);

await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  JSON.stringify(
    {
      run: { startedAt, model, baseUrl, temperature, seed, caseSetHash, caseCount: cases.length, totalCaseCount: allCases.length },
      ...report,
    },
    null,
    2,
  ),
);
console.log(`\nReport written to ${outPath}`);
