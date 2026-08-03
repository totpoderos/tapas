# The rate limit counts across instances

## Why

Sensitive routes — signing in, joining by code, claiming a deployment, accepting
an invitation — are limited to five attempts a minute from one address. The
counter lives in the memory of one process (`@fastify/rate-limit`'s default
store, and no other is configured), which was exactly right while there was one
process.

A deployment that runs several instances counts separately in each, so the real
ceiling is five times however many are running, and every cold start begins
again from zero. `docs/threat-model.md` names this control twice — once in the
A04 row, once under A07 beside the account lockout it is said to reinforce — and
both entries would quietly stop being true.

What makes it worth doing rather than recording is that **it is the one control
here that degrades silently**. A database that cannot be reached fails loudly. A
mail server that will not accept a message is reported to the host. A rate limit
that has stopped limiting looks exactly like one that is working: no error, no
log line, nothing on a screen. It would be discovered by whoever was
brute-forcing it.

The lockout that reinforces it is unaffected — it counts failed attempts against
an account, in the database. What is lost is the source-address half, which is
the half that sees an attack spread across many accounts.

## What Changes

- The rate limiter **counts in the database** rather than in one process's
  memory, so every instance reads and writes the same count.
- One counter, one behaviour, on every deployment. A single-instance deployment
  gets the same store as a many-instance one, rather than two code paths of
  which only one is ever exercised.
- **It fails closed.** A store that cannot be read refuses the request rather
  than waving it through — the plugin's default is the opposite, and a security
  control whose failure mode is "allow" is not one.
- Expired counters are cleared as they are met, so the table does not grow
  without bound.
- **No new external service.** The counter goes where the accounts and the
  contests already are.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `response-hardening` — the rate limit is a property of the deployment rather
  than of a process, and says what it does when it cannot count.

## Impact

- `packages/api/src/http/rate-limit.ts` — the store, and the registration that
  uses it.
- `packages/api/migrations/` — one table.
- `docs/threat-model.md` — the A04 and A07 entries say what is now true.
- No change to which routes are limited, to the ceiling, or to what a limited
  caller is told. A deployment that upgrades sees the same behaviour it had.

## Out of scope

- **Distributed lockout, or anything cleverer than counting.** Per-address
  counting is what exists; making it smarter is a different argument with
  different evidence behind it.
- **The global 1000/minute default.** It exists to blunt accidental floods, not
  attacks, and a per-process approximation of that is fine.
