/**
 * Where the participant app answers for a join code.
 *
 * The one place in the API that knows the participant app's deep-link shape. It
 * is composed here rather than in the host panel because the address is a
 * deployment fact — the same contest read from two deployments has two different
 * links — and the panel's built assets are deliberately deployment-agnostic, so
 * nothing in them may know a domain. See the change's design.md.
 */
const JOIN_PATH = 'j';

/**
 * The link that opens the participant app already carrying `joinCode`.
 *
 * A trailing slash on the address is normalised, so a deployment writing
 * `https://join.example.com/` and one writing it without both produce the same
 * link rather than one with `//j/`. Any other path the address carries is kept:
 * a participant app served under a sub-path is a deployment's business.
 *
 * The code is escaped rather than glued in. Codes are issued uppercase
 * alphanumeric so nothing in one needs escaping today — but this builds a URL
 * out of a string, and that is precisely where a `../` slipped into the value
 * would send a whole room somewhere other than the contest.
 */
export function joinLinkFor(participantWebOrigin: string, joinCode: string): string {
  const address = participantWebOrigin.replace(/\/+$/, '');
  return `${address}/${JOIN_PATH}/${encodeURIComponent(joinCode)}`;
}
