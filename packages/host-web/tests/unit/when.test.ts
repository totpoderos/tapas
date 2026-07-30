import { describe, expect, it } from 'vitest';
import { whenLastChanged } from '../../src/contests/when';

/** A fixed "now" — the clock is passed in so these say the same thing every run. */
const NOW = Date.parse('2026-07-30T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe('when something last changed', () => {
  it('says how long ago, for something that just happened', () => {
    expect(whenLastChanged(ago(2 * MINUTE), 'en', NOW)).toBe('2 minutes ago');
  });

  it('rounds up to the largest whole unit', () => {
    // 90 minutes is an hour ago, not ninety minutes ago.
    expect(whenLastChanged(ago(90 * MINUTE), 'en', NOW)).toBe('1 hour ago');
  });

  it('says yesterday rather than one day ago', () => {
    expect(whenLastChanged(ago(DAY), 'en', NOW)).toBe('yesterday');
  });

  it('gives a date once "days ago" stops helping', () => {
    expect(whenLastChanged(ago(20 * DAY), 'en', NOW)).toBe('Jul 10');
  });

  it('carries the year when it is not this one', () => {
    expect(whenLastChanged('2025-02-02T10:00:00.000Z', 'en', NOW)).toBe('Feb 2, 2025');
  });

  it('follows the interface language without a translation of its own', () => {
    expect(whenLastChanged(ago(2 * MINUTE), 'es', NOW)).toBe('hace 2 minutos');
    expect(whenLastChanged(ago(20 * DAY), 'es', NOW)).toBe('10 jul');
  });

  it('says nothing rather than "Invalid Date" for something unreadable', () => {
    expect(whenLastChanged('not a date', 'en', NOW)).toBe('');
  });

  it('says just now for something younger than a minute', () => {
    expect(whenLastChanged(ago(5_000), 'en', NOW)).toBe('this minute');
  });

  it('counts hours while the change is hours old', () => {
    expect(whenLastChanged(ago(5 * HOUR), 'en', NOW)).toBe('5 hours ago');
  });
});
