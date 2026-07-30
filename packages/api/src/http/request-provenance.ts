import { randomUUID } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { IN_APP, type AuditProvenance } from '../audit/audit-projection.js';

/**
 * How an action reached the API, carried across the assistant's dispatch.
 *
 * The assistant runs every tool by turning it into an ordinary API request and
 * dispatching it back through this same app, carrying the host's cookie. That is
 * what keeps one execution path and one set of ownership checks — and it is also
 * why, by the time a route sees the request, nothing distinguishes it from the
 * host working in the app. This carries that distinction across the dispatch.
 *
 * **The provenance itself never becomes a header.** The confirmation marker can
 * be one, because it is a single fixed word; a tool's arguments are
 * model-produced JSON of unbounded shape, and serialising that into a header
 * would mean inventing an encoding and putting untrusted text somewhere a proxy
 * might log or truncate — for data that never leaves this process. So the header
 * carries an opaque ticket, and the provenance stays in memory beside it.
 *
 * *`AsyncLocalStorage` was tried first and does not work here:* `app.inject`
 * routes the request through light-my-request, which crosses a stream boundary
 * that drops the async context, so the handler sees an empty store. Verified
 * before this was written, not assumed.
 */
const TICKET_HEADER = 'x-tapas-dispatch';

/** Live dispatches only. An entry exists for the length of one `inject` and no longer. */
const inFlight = new Map<string, AuditProvenance>();

/**
 * Runs `work` with the requests it dispatches marked as having come this way.
 *
 * `work` is given the headers to pass on. The entry is dropped in a `finally`, so
 * a ticket cannot outlive its dispatch and be reused — by a later request or by
 * anything guessing at one.
 */
export async function dispatchedAs<T>(
  provenance: AuditProvenance,
  work: (headers: Record<string, string>) => Promise<T>,
): Promise<T> {
  const ticket = randomUUID();
  inFlight.set(ticket, provenance);
  try {
    return await work({ [TICKET_HEADER]: ticket });
  } finally {
    inFlight.delete(ticket);
  }
}

/**
 * How the request being handled arrived.
 *
 * The single place that decides what an unmarked request means, so no route has
 * to remember that the absence of a mark is the app rather than unknown. A
 * ticket that names no live dispatch is treated as no ticket at all: the header
 * on its own grants nothing, and the worst an outside caller could achieve by
 * guessing a live one is to mislabel the provenance of their own action in their
 * own log.
 */
export function provenanceOfRequest(request: FastifyRequest): AuditProvenance {
  const ticket = request.headers[TICKET_HEADER];
  if (typeof ticket !== 'string') return IN_APP;
  return inFlight.get(ticket) ?? IN_APP;
}
