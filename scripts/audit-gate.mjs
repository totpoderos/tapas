#!/usr/bin/env node
// Supply-chain gate (tasks.md 6.3/6.4). Fails on any HIGH/CRITICAL npm advisory
// that is not covered by a non-expired entry in `.audit-allowlist.json`. An
// allowlisted advisory is reported as a justified exception; an EXPIRED
// allowlist entry stops suppressing its advisory (forcing re-review); any new,
// unlisted high/critical blocks. Moderate/low advisories are not gated here.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);

const audit = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(audit.stdout || '');
} catch {
  console.error('audit-gate: could not parse `npm audit --json` output');
  console.error(audit.stderr || audit.stdout || '(no output)');
  process.exit(2);
}

let allow = [];
try {
  allow = JSON.parse(readFileSync(new URL('.audit-allowlist.json', root), 'utf8')).allow ?? [];
} catch (error) {
  console.error(`audit-gate: could not read .audit-allowlist.json: ${error.message}`);
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);
const active = new Map();
const expired = [];
for (const entry of allow) {
  if (entry.expires && entry.expires < today) expired.push(entry);
  else active.set(entry.id, entry);
}

// Collect distinct HIGH/CRITICAL advisories (keyed by GHSA id from the URL).
const found = new Map();
for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== 'object' || !['high', 'critical'].includes(via.severity)) continue;
    const id = (via.url ?? '').split('/').pop();
    if (!id) continue;
    if (!found.has(id)) found.set(id, { title: via.title, severity: via.severity, pkgs: new Set() });
    found.get(id).pkgs.add(pkg);
  }
}

const suppressed = [...found].filter(([id]) => active.has(id));
const blocking = [...found].filter(([id]) => !active.has(id));

const line = (label, [id, info]) =>
  `  ${label} ${info.severity.toUpperCase().padEnd(8)} ${id}  ${info.title}\n      packages: ${[...info.pkgs].join(', ')}`;

if (suppressed.length) {
  console.log('Allowlisted (justified exceptions):');
  for (const row of suppressed) {
    console.log(line('•', row));
    console.log(`      reason: ${active.get(row[0]).reason}`);
    console.log(`      expires: ${active.get(row[0]).expires}`);
  }
  console.log('');
}

if (expired.length) {
  console.log('EXPIRED allowlist entries (no longer suppressing — review & renew or fix):');
  for (const entry of expired) console.log(`  ! ${entry.id} expired ${entry.expires} — ${entry.package}`);
  console.log('');
}

if (blocking.length) {
  console.error('Supply-chain gate FAILED — high/critical advisories not allowlisted:');
  for (const row of blocking) console.error(line('✗', row));
  console.error(
    '\nFix the dependency, or (if genuinely not applicable) add a justified, expiring entry to .audit-allowlist.json.',
  );
  process.exit(1);
}

const counts = report.metadata?.vulnerabilities ?? {};
console.log(
  `Supply-chain gate PASSED — 0 blocking high/critical` +
    (suppressed.length ? `, ${suppressed.length} allowlisted` : '') +
    ` (moderate ${counts.moderate ?? 0}, low ${counts.low ?? 0} not gated).`,
);
process.exit(0);
