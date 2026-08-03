import { describe, expect, it } from 'vitest';
import { IssuePat, RevokePat, type Clock } from '../../../../src/index.js';
import { FakeHostPatRepository } from '../pat-support.js';

const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };

function makeRevokePatEnv() {
  const pats = new FakeHostPatRepository();
  let sequence = 0;
  const ids = { next: () => `pat-${++sequence}` };
  return { issuePat: new IssuePat({ pats, ids, clock }), revokePat: new RevokePat({ pats }), pats };
}

describe('RevokePat', async () => {
  it("revokes the issuing host's own token", async () => {
    const { issuePat, revokePat, pats } = makeRevokePatEnv();
    const issued = await issuePat.execute('host-1');

    const revokeOutcome = await revokePat.execute(issued.patId, 'host-1');

    expect(revokeOutcome.ok).toBe(true);
    expect((await pats.findById(issued.patId))?.revokedAt).toBeTruthy();
  });

  it('refuses to revoke a token belonging to another host', async () => {
    const { issuePat, revokePat } = makeRevokePatEnv();
    const issued = await issuePat.execute('host-1');

    const revokeOutcome = await revokePat.execute(issued.patId, 'host-2');

    expect(revokeOutcome.ok).toBe(false);
    if (!revokeOutcome.ok) expect(revokeOutcome.error.code).toBe('NOT_ALLOWED');
  });

  it('refuses to revoke an unknown token', async () => {
    const { revokePat } = makeRevokePatEnv();

    const revokeOutcome = await revokePat.execute('nope', 'host-1');

    expect(revokeOutcome.ok).toBe(false);
    if (!revokeOutcome.ok) expect(revokeOutcome.error.code).toBe('PAT_NOT_FOUND');
  });
});
