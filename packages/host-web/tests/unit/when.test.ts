import { describe, expect, it } from 'vitest';
import { whenLastChanged, whenHappened } from '../../src/contests/when';

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

/**
 * The times are built by setting local hours, so these say the same thing
 * wherever they run — which the log's own day arithmetic has to be too.
 */
function at(dayOffset: number, hours: number, minutes: number): string {
  const when = new Date(NOW);
  when.setDate(when.getDate() + dayOffset);
  when.setHours(hours, minutes, 0, 0);
  return when.toISOString();
}

describe('when something happened', () => {
  it('names today and gives the time of day', () => {
    expect(whenHappened(at(0, 9, 30), 'en', NOW)).toBe('today 09:30 AM');
  });

  it('names yesterday by the calendar, not by twenty-four hours', () => {
    // Late last night, read this lunchtime: fewer than 24 hours ago, but a host
    // would still call it yesterday.
    expect(whenHappened(at(-1, 23, 50), 'en', NOW)).toBe('yesterday 11:50 PM');
  });

  it('gives the date once the day has no name left', () => {
    expect(whenHappened('2026-07-10T09:30:00.000Z', 'en', NOW)).toMatch(/^Jul 10 \d\d:\d\d [AP]M$/);
  });

  it('carries the year when it is not this one', () => {
    expect(whenHappened('2025-02-02T09:30:00.000Z', 'en', NOW)).toMatch(/^Feb 2, 2025 /);
  });

  it('keeps the time of day even for something that just happened', () => {
    // Unlike the contest list: two actions a minute apart are a different story
    // from two an hour apart, and "2 minutes ago" cannot tell them apart.
    expect(whenHappened(at(0, 11, 59), 'en', NOW)).toBe('today 11:59 AM');
  });

  it('follows the interface language for both halves', () => {
    expect(whenHappened(at(0, 9, 30), 'es', NOW)).toBe('hoy 09:30');
    expect(whenHappened(at(-1, 9, 30), 'es', NOW)).toBe('ayer 09:30');
  });

  it('says nothing rather than "Invalid Date" for something unreadable', () => {
    expect(whenHappened('not a date', 'en', NOW)).toBe('');
  });
});
