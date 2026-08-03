import { describe, expect, it } from 'vitest';
import { hashPatToken, IssuePat, type Clock } from '../../../../src/index.js';
import { FakeHostPatRepository } from '../pat-support.js';

const clock: Clock = { now: () => '2026-07-19T10:00:00.000Z' };

function makeIssuePat() {
  const pats = new FakeHostPatRepository();
  let sequence = 0;
  const ids = { next: () => `pat-${++sequence}` };
  return { issuePat: new IssuePat({ pats, ids, clock }), pats };
}

describe('IssuePat', async () => {
  it('issues a usable token', async () => {
    const { issuePat } = makeIssuePat();

    const issued = await issuePat.execute('host-1');

    expect(issued.token).toBeTruthy();
    expect(issued.patId).toBeTruthy();
  });

  it('stores only the hash of the token, scoped to the issuing host', async () => {
    const { issuePat, pats } = makeIssuePat();

    const issued = await issuePat.execute('host-1');

    const stored = await pats.findById(issued.patId);
    expect(stored?.hostId).toBe('host-1');
    expect(stored?.tokenHash).toBe(hashPatToken(issued.token));
    expect(stored?.tokenHash).not.toBe(issued.token);
  });

  it('issues a different token each time', async () => {
    const { issuePat } = makeIssuePat();

    const first = await issuePat.execute('host-1');
    const second = await issuePat.execute('host-1');

    expect(first.token).not.toBe(second.token);
  });
});
