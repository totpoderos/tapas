import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const compose = readFileSync(join(REPO_ROOT, 'docker-compose.prod.yml'), 'utf8');
const example = readFileSync(join(REPO_ROOT, '.env.prod.example'), 'utf8');

/** `${FOO:?message}` — a variable compose refuses to start without. */
function required(manifest: string): string[] {
  return [...manifest.matchAll(/\$\{([A-Z_]+):\?/g)].map((match) => match[1]!).sort();
}

/** `FOO=` at the start of a line — a variable the example file actually offers. */
function offered(envFile: string): Set<string> {
  return new Set([...envFile.matchAll(/^([A-Z_]+)=/gm)].map((match) => match[1]!));
}

/*
 * The deploy path's own regression test.
 *
 * `.env.prod.example` promises a working starting point — the compose file's
 * header says to copy it, set the domains and secrets, and bring the stack up.
 * It stopped being one: three variables the manifest refuses to start without
 * were missing from it, so following those instructions failed on `set
 * MAIL_HOST` with no hint of what else was absent.
 *
 * Nothing could have caught that. The two files are read by a person on a
 * server, once, under time pressure — which is the worst place to discover a
 * documentation gap and the least likely place to have a test.
 */
describe('the production env example', () => {
  it('offers every variable the compose manifest refuses to start without', () => {
    const missing = required(compose).filter((name) => !offered(example).has(name));
    expect(missing).toEqual([]);
  });

  /*
   * The other direction is deliberately NOT asserted. The example carries
   * optional settings too (MAIL_PORT, LLM_MODEL, the transport switch), and
   * demanding they all be required would push whoever adds one into making it
   * mandatory just to keep this green.
   */
  it('is a superset, not a mirror', () => {
    expect(offered(example).size).toBeGreaterThan(required(compose).length);
  });
});
