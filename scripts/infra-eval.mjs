#!/usr/bin/env node
/**
 * Infrastructure eval (tasks.md 6.5) — the THIRD AI surface.
 *
 * The other two AI surfaces (contest creation, host assistant) are scored against
 * a model's output. This one scores the *artifacts* an AI produced: the
 * Dockerfiles, compose files, CI and CD. The criteria are the ones the task names
 * — it **builds**, its **tests pass**, it **deploys** (dry-run), and it is
 * **human-readable** — turned into checks that either pass or fail, so the result
 * is a number that can be tracked over time rather than an opinion.
 *
 *   node scripts/infra-eval.mjs            # static checks only (fast, no Docker)
 *   node scripts/infra-eval.mjs --full     # + docker build, compose config, tests
 *   node scripts/infra-eval.mjs --json     # machine-readable report
 *
 * Exit code is 0 when the weighted score meets THRESHOLD, 1 when it does not —
 * so this can gate like the model evals do.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FULL = process.argv.includes('--full');
const AS_JSON = process.argv.includes('--json');

/** Committed threshold: the weighted score the generated infra must hold. */
const THRESHOLD = 0.85;

const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);

function run(cmd, args, timeoutMs = 900_000) {
  try {
    execFileSync(cmd, args, { cwd: ROOT, stdio: 'pipe', timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * A "readable" artifact is one a human can maintain: comments that say WHY, not
 * just what. We approximate with comment density over non-blank lines — crude,
 * but consistent across runs and honest about what it measures.
 */
function commentDensity(text) {
  const lines = text.split('\n').filter((l) => l.trim());
  if (!lines.length) return 0;
  const comments = lines.filter((l) => /^\s*(#|\/\/|<!--)/.test(l)).length;
  return comments / lines.length;
}

const SERVICES = ['api', 'mcp', 'host-web', 'participant-web'];

/** Each criterion: id, the dimension it scores, weight, and a check returning bool. */
const CRITERIA = [
  // --- Builds -------------------------------------------------------------
  {
    id: 'dockerfiles-present',
    dimension: 'builds',
    weight: 2,
    detail: 'a Dockerfile exists for every deployable',
    check: () => SERVICES.every((s) => read(`packages/${s}/Dockerfile`)),
  },
  {
    id: 'dockerignore-present',
    dimension: 'builds',
    weight: 1,
    detail: 'build context is trimmed (.dockerignore excludes node_modules and secrets)',
    check: () => {
      const t = read('.dockerignore');
      return !!t && /node_modules/.test(t) && /\.env/.test(t);
    },
  },
  {
    id: 'images-build',
    dimension: 'builds',
    weight: 3,
    detail: 'every image actually builds',
    requiresFull: true,
    check: () =>
      SERVICES.every((s) =>
        run('docker', [
          'build', '--provenance=false', '--sbom=false',
          '-f', `packages/${s}/Dockerfile`, '-t', `tapas-${s}:evalrun`, '.',
        ]),
      ),
  },
  // --- Tests pass ---------------------------------------------------------
  {
    id: 'ci-runs-tests',
    dimension: 'tests',
    weight: 2,
    detail: 'CI runs the deterministic suite as a hard gate',
    check: () => {
      const t = read('.github/workflows/ci.yml');
      return !!t && /npm test/.test(t) && /npm run typecheck/.test(t) && /npm run lint/.test(t);
    },
  },
  {
    id: 'ci-a11y-gate',
    dimension: 'tests',
    weight: 1,
    detail: 'CI gates accessibility via the E2E',
    check: () => {
      const t = read('.github/workflows/ci.yml');
      return !!t && /test:e2e/.test(t);
    },
  },
  {
    id: 'ci-supply-chain-gate',
    dimension: 'tests',
    weight: 1,
    detail: 'CI gates the supply chain',
    check: () => {
      const t = read('.github/workflows/ci.yml');
      return !!t && /audit/.test(t);
    },
  },
  {
    id: 'suite-passes',
    dimension: 'tests',
    weight: 3,
    detail: 'the test suite actually passes',
    requiresFull: true,
    check: () => run('npm', ['test'], 900_000),
  },
  // --- Deploys (dry-run) --------------------------------------------------
  {
    id: 'compose-valid',
    dimension: 'deploys',
    weight: 2,
    detail: 'the dev compose manifest is valid',
    requiresFull: true,
    check: () => run('docker', ['compose', '-f', 'docker-compose.yml', 'config', '--quiet']),
  },
  {
    id: 'compose-prod-valid',
    dimension: 'deploys',
    weight: 2,
    detail: 'the production manifest renders (deploy dry-run)',
    requiresFull: true,
    check: () =>
      run('docker', ['compose', '-f', 'docker-compose.prod.yml', 'config', '--quiet']),
    env: {
      REGISTRY_OWNER: '', TAG: 'evalrun',
      HOST_DOMAIN: 'host.example.com', PARTICIPANT_DOMAIN: 'app.example.com',
      TLS_EMAIL: 'admin@example.com',
      JWT_SECRET: 'infra-eval-placeholder-secret-32-chars-x',
      ASSISTANT_CONFIRMATION_SECRET: 'infra-eval-placeholder-confirm-32-chars',
    },
  },
  {
    id: 'cd-on-tag',
    dimension: 'deploys',
    weight: 1,
    detail: 'CD triggers on a version tag and pushes images',
    check: () => {
      const t = read('.github/workflows/cd.yml');
      return !!t && /tags:/.test(t) && /ghcr\.io/.test(t);
    },
  },
  {
    id: 'tls-edge',
    dimension: 'deploys',
    weight: 1,
    detail: 'production terminates TLS at a documented edge',
    check: () => !!read('deploy/Caddyfile') && !!read('docker-compose.prod.yml'),
  },
  // --- Human-readable -----------------------------------------------------
  {
    id: 'artifacts-commented',
    dimension: 'readable',
    weight: 2,
    detail: 'generated artifacts carry explanatory comments (≥15% of lines)',
    check: () =>
      [...SERVICES.map((s) => `packages/${s}/Dockerfile`), 'docker-compose.yml', '.github/workflows/ci.yml']
        .map(read)
        .every((t) => t && commentDensity(t) >= 0.15),
  },
  {
    id: 'generation-documented',
    dimension: 'readable',
    weight: 2,
    detail: 'the generation record documents prompt → output → verification',
    check: () => {
      const t = read('docs/infra-generation.md');
      return !!t && /[Vv]erification/.test(t) && /[Pp]rompt/.test(t) && /[Oo]utput/.test(t);
    },
  },
  {
    id: 'env-documented',
    dimension: 'readable',
    weight: 1,
    detail: 'configuration is documented by example files',
    check: () => !!read('.env.example') && !!read('.env.prod.example'),
  },
  {
    id: 'secrets-not-baked',
    dimension: 'readable',
    weight: 1,
    detail: 'no secret literals baked into the images',
    check: () =>
      SERVICES.map((s) => read(`packages/${s}/Dockerfile`)).every(
        (t) => t && !/(SECRET|TOKEN|PASSWORD)\s*=\s*["']?[A-Za-z0-9+/]{16,}/.test(t),
      ),
  },
];

const DIMENSIONS = { builds: 'Builds', tests: 'Tests pass', deploys: 'Deploys (dry-run)', readable: 'Human-readable' };

const results = [];
for (const c of CRITERIA) {
  if (c.requiresFull && !FULL) {
    results.push({ ...c, status: 'skipped', passed: null });
    continue;
  }
  const saved = {};
  if (c.env) for (const [k, v] of Object.entries(c.env)) { saved[k] = process.env[k]; process.env[k] = v; }
  let passed = false;
  try { passed = !!c.check(); } catch { passed = false; }
  if (c.env) for (const [k] of Object.entries(c.env)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  results.push({ ...c, status: passed ? 'pass' : 'fail', passed });
}

const scored = results.filter((r) => r.status !== 'skipped');
const earned = scored.filter((r) => r.passed).reduce((n, r) => n + r.weight, 0);
const possible = scored.reduce((n, r) => n + r.weight, 0);
const score = possible ? earned / possible : 0;

const byDimension = Object.keys(DIMENSIONS).map((dim) => {
  const rows = scored.filter((r) => r.dimension === dim);
  const e = rows.filter((r) => r.passed).reduce((n, r) => n + r.weight, 0);
  const p = rows.reduce((n, r) => n + r.weight, 0);
  return { dimension: dim, label: DIMENSIONS[dim], earned: e, possible: p, score: p ? e / p : null };
});

if (AS_JSON) {
  console.log(JSON.stringify({
    mode: FULL ? 'full' : 'static',
    threshold: THRESHOLD,
    overall: { earned, possible, score },
    byDimension,
    criteria: results.map(({ id, dimension, weight, detail, status }) => ({ id, dimension, weight, detail, status })),
  }, null, 2));
} else {
  const pct = (n) => (n === null ? '  --  ' : `${(n * 100).toFixed(1)}%`);
  console.log(`Infrastructure eval — ${FULL ? 'full' : 'static-only (pass --full for build/deploy checks)'}\n`);
  for (const dim of Object.keys(DIMENSIONS)) {
    console.log(`${DIMENSIONS[dim]}`);
    for (const r of results.filter((x) => x.dimension === dim)) {
      const mark = r.status === 'pass' ? 'PASS' : r.status === 'fail' ? 'FAIL' : 'skip';
      console.log(`  ${mark}  [${r.weight}] ${r.detail}`);
    }
    const d = byDimension.find((x) => x.dimension === dim);
    console.log(`        → ${pct(d.score)} (${d.earned}/${d.possible})\n`);
  }
  console.log(`Overall: ${pct(score)}  (${earned}/${possible} weighted)  — threshold ${pct(THRESHOLD)}`);
  const skipped = results.filter((r) => r.status === 'skipped').length;
  if (skipped) console.log(`${skipped} check(s) skipped — re-run with --full to score them.`);
  console.log(score >= THRESHOLD ? '\nInfrastructure eval PASSED' : '\nInfrastructure eval FAILED — below the committed threshold');
}

process.exit(score >= THRESHOLD ? 0 : 1);
