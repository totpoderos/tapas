import { describe, expect, it } from 'vitest';
import { shouldAutoClose } from '../../../src/index.js';

describe('shouldAutoClose', () => {
  it('never auto-closes on host_trigger', () => {
    expect(shouldAutoClose({ when: 'host_trigger' }, { allPlacesSent: true }, '2026-07-21T10:00:00.000Z')).toBe(
      false,
    );
  });

  it('closes on all_sent once every place on the roster has sent', () => {
    expect(shouldAutoClose({ when: 'all_sent' }, { allPlacesSent: true }, '2026-07-21T10:00:00.000Z')).toBe(true);
  });

  it('does not close on all_sent while any place has not sent yet', () => {
    expect(shouldAutoClose({ when: 'all_sent' }, { allPlacesSent: false }, '2026-07-21T10:00:00.000Z')).toBe(
      false,
    );
  });

  it('closes on scheduled once the scheduled time has passed', () => {
    const closeRule = { when: 'scheduled' as const, at: '2026-07-21T10:00:00.000Z' };
    expect(shouldAutoClose(closeRule, { allPlacesSent: false }, '2026-07-21T10:00:01.000Z')).toBe(true);
  });

  it('does not close on scheduled before the scheduled time', () => {
    const closeRule = { when: 'scheduled' as const, at: '2026-07-21T10:00:00.000Z' };
    expect(shouldAutoClose(closeRule, { allPlacesSent: false }, '2026-07-21T09:59:59.000Z')).toBe(false);
  });

  it('closes exactly at the scheduled time', () => {
    const closeRule = { when: 'scheduled' as const, at: '2026-07-21T10:00:00.000Z' };
    expect(shouldAutoClose(closeRule, { allPlacesSent: false }, '2026-07-21T10:00:00.000Z')).toBe(true);
  });
});
