import { describe, expect, it } from 'vitest';
import { shouldAutoClose } from '../../../src/index.js';

describe('shouldAutoClose', () => {
  it('never auto-closes on host_trigger', () => {
    expect(shouldAutoClose({ when: 'host_trigger' }, { allClaimedSent: true }, '2026-07-21T10:00:00.000Z')).toBe(
      false,
    );
  });

  it('closes on all_sent once every claimed participant has sent', () => {
    expect(shouldAutoClose({ when: 'all_sent' }, { allClaimedSent: true }, '2026-07-21T10:00:00.000Z')).toBe(true);
  });

  it('does not close on all_sent while someone has not sent yet', () => {
    expect(shouldAutoClose({ when: 'all_sent' }, { allClaimedSent: false }, '2026-07-21T10:00:00.000Z')).toBe(
      false,
    );
  });

  it('closes on scheduled once the scheduled time has passed', () => {
    const closeRule = { when: 'scheduled' as const, at: '2026-07-21T10:00:00.000Z' };
    expect(shouldAutoClose(closeRule, { allClaimedSent: false }, '2026-07-21T10:00:01.000Z')).toBe(true);
  });

  it('does not close on scheduled before the scheduled time', () => {
    const closeRule = { when: 'scheduled' as const, at: '2026-07-21T10:00:00.000Z' };
    expect(shouldAutoClose(closeRule, { allClaimedSent: false }, '2026-07-21T09:59:59.000Z')).toBe(false);
  });

  it('closes exactly at the scheduled time', () => {
    const closeRule = { when: 'scheduled' as const, at: '2026-07-21T10:00:00.000Z' };
    expect(shouldAutoClose(closeRule, { allClaimedSent: false }, '2026-07-21T10:00:00.000Z')).toBe(true);
  });
});
