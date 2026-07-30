/** A day, in milliseconds — the point past which "3 days ago" stops helping. */
const DAY = 86_400_000;
const WITHIN = [
  { unit: 'minute' as const, ms: 60_000 },
  { unit: 'hour' as const, ms: 3_600_000 },
  { unit: 'day' as const, ms: DAY },
];

/**
 * When something last changed, said the way a host would say it: "2 minutes ago"
 * for what just happened, a date for what did not.
 *
 * `Intl` does the phrasing, so it follows the interface language without a
 * translation of its own — and a date is never assembled by hand, which is how
 * month names end up in the wrong language.
 */
export function whenLastChanged(iso: string, language: string, now = Date.now()): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';

  const ago = now - at;
  if (ago < 7 * DAY) {
    const relative = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    // The largest unit that still has a whole number in it: 90 minutes reads as
    // "1 hour ago" rather than "90 minutes ago".
    const scale = [...WITHIN].reverse().find(({ ms }) => ago >= ms) ?? WITHIN[0]!;
    return relative.format(-Math.floor(ago / scale.ms), scale.unit);
  }

  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(at);
}

/**
 * When something happened, for a log rather than for a list: always the time of
 * day, because two actions a minute apart are a different story from two an hour
 * apart, and "2 hours ago" cannot tell them apart at a glance.
 *
 * The day is named relatively while that still means something — today,
 * yesterday — and given as a date after that. Both halves come from `Intl`, so
 * "yesterday" and the month name follow the interface language together.
 */
export function whenHappened(iso: string, language: string, now = Date.now()): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';

  const clock = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }).format(at);
  // Whole calendar days apart, not 24-hour blocks: something at 23:50 last night
  // is "yesterday" at 08:00 this morning, which is how a host would say it.
  const days = midnight(at) === midnight(now) ? 0 : midnight(at) === midnight(now - DAY) ? -1 : null;
  if (days !== null) {
    const named = new Intl.RelativeTimeFormat(language, { numeric: 'auto' }).format(days, 'day');
    return `${named} ${clock}`;
  }

  const sameYear = new Date(at).getFullYear() === new Date(now).getFullYear();
  const day = new Intl.DateTimeFormat(language, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(at);
  return `${day} ${clock}`;
}

/** The start of the local day a moment falls in. */
function midnight(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
