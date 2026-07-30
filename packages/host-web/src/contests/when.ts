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
