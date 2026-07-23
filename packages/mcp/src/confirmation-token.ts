import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * The confirmation gate for destructive tools (design.md §7.1). A destructive
 * call is refused until it carries a `confirmationToken` the server itself
 * minted for that exact action; the client obtains one by making the call
 * first, showing the host, and calling again with it.
 *
 * The token is an HMAC over the tool name and its arguments — deliberately not a
 * plain hash. A plain hash the client could compute itself, skipping the
 * confirmation; an HMAC keyed by a server secret cannot be forged, so the token
 * proves the SERVER issued a confirmation for this action, which is what forces
 * the two-step flow. Keying it to the arguments makes it action-bound: a token
 * for "close contest A" will not validate "close contest B".
 *
 * The token is deterministic, so it is replayable for the *same* action; true
 * single-use would need a server-side nonce store and is left as future
 * hardening (it matters most for noisy tools like send_reminder).
 */

/** Stable string for a tool call — keys sorted, and the token field itself excluded. */
function canonicalArgs(args: Record<string, unknown>): string {
  const entries = Object.entries(args)
    .filter(([key]) => key !== 'confirmationToken')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return JSON.stringify(entries);
}

export function confirmationTokenFor(
  secret: string,
  toolName: string,
  args: Record<string, unknown>,
): string {
  return createHmac('sha256', secret).update(`${toolName}\n${canonicalArgs(args)}`).digest('hex');
}

/** True only when `provided` matches the token this exact action would be issued. Timing-safe. */
export function isValidConfirmation(
  secret: string,
  toolName: string,
  args: Record<string, unknown>,
  provided: unknown,
): boolean {
  if (typeof provided !== 'string') return false;
  const expected = confirmationTokenFor(secret, toolName, args);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
