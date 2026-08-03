# Design — The rate limit counts across instances

## Context

`@fastify/rate-limit` is registered with a global 1000/minute and a per-route
override of 5/minute on the sensitive entry points — login, join-by-code, claim,
invite, accept (15 call sites). No `store` is configured, so it uses its default:
a map in the process's memory.

Two things have changed around it. The deployment may now run on a platform that
starts several instances, and — since `the-database-becomes-a-choice` — the API
has one `Database` port with adapters for SQLite and Postgres, and a body of SQL
already constrained to what both understand.

## Goals / Non-Goals

**Goals:**

- One count per source per deployment, however many instances are serving it.
- One code path. A single-instance deployment counts the same way a many-instance
  one does.
- The failure mode is refusal, not admission.

**Non-Goals:**

- Changing which routes are limited, the ceiling, or what a limited caller is
  told. A deployment that upgrades sees the behaviour it already had.
- The global 1000/minute default. It blunts accidental floods rather than
  attacks, and a per-process approximation is fine for that.
- Anything smarter than counting per address.

## Decisions

### 1. The counter goes in the database, not in a new service

`@fastify/rate-limit` takes a custom `store` with one method — `incr(key, cb,
timeWindow, max)` answering `{ current, ttl }`. That is small enough to implement
over the `Database` port directly.

*Alternative considered:* Redis (Upstash's free tier is the usual answer for
serverless). Rejected for this codebase: it is a second piece of infrastructure
to run, configure, secure and pay attention to, in a project whose whole
deployment story is "one compose file" or "one platform" — and it would be the
only external service the API cannot start without. The database is already
there, already reached on every one of these requests (login reads an account;
join reads a contest), and already abstracted behind a port that works on both
engines.

The cost is one small write per sensitive request. Sensitive requests are login
and join; login already pays bcrypt, which is orders of magnitude more.

### 2. One statement, and it must be atomic

Two instances incrementing at once must not both read 4 and write 5. The whole
operation is one upsert:

```sql
INSERT INTO rate_limits (bucket, count, window_started_at) VALUES (?, 1, ?)
ON CONFLICT (bucket) DO UPDATE SET
  count = CASE WHEN rate_limits.window_started_at <= ? THEN 1 ELSE rate_limits.count + 1 END,
  window_started_at = CASE WHEN rate_limits.window_started_at <= ? THEN ? ELSE rate_limits.window_started_at END
RETURNING count, window_started_at
```

`ON CONFLICT … DO UPDATE` and `RETURNING` are understood by both engines — the
schema already uses the former twice — so this stays inside the intersection
accepted in `the-database-becomes-a-choice`. The window reset is folded into the
same statement rather than read-then-write, because read-then-write is the race
this exists to avoid.

### 3. It fails closed

The plugin's `skipOnError` defaults to true: a store that throws lets the request
through. That is a sensible default for a throughput limiter and the wrong one
for a brute-force control, so it is set to false.

This costs nothing in practice. Every route it guards needs the database for its
own work — a login that cannot reach the database cannot check a password — so a
store failure is a request that was going to fail anyway. What changes is only
which of the two failures is reported.

### 4. Expired rows are cleared as they are met

A bucket whose window has passed is reset by the statement above rather than
accumulating a second row, so the table holds at most one row per source seen. A
periodic sweep of rows untouched for far longer than any window keeps it from
holding addresses forever; there is no need for it to be exact.

*Alternative considered:* a background timer. Rejected — a timer is a thing to
start, stop, and forget to stop in tests, for a table that will hold tens of rows.

### 5. Time comes from the clock the rest of the system uses

The window is compared against `Clock.now()`, the same injected clock the
lockout, the invitations and the audit log use, so a spec can drive a window
past without waiting a real minute — which is the only way the "waited it out"
scenario can be tested at all.

## Risks / Trade-offs

- **A write on every sensitive request** → they are login and join; login already
  pays bcrypt. If this ever shows up in a profile, the answer is to widen the
  window rather than to move the counter back into memory.
- **Failing closed turns a database blip into a refused login** → those requests
  were failing anyway; the database is on their path regardless.
- **Two instances race on the same bucket** → one statement, so the database
  serialises them. This is the reason it is one statement.
- **The table grows** → one row per source, reset in place, swept when stale.
- **A caller behind a shared address** (a venue's wifi, where a contest actually
  happens) shares a bucket with everyone else there → true today too, unchanged
  by this. Worth knowing before the ceiling is ever lowered.

## Migration Plan

One new table, one migration. No existing behaviour changes, so an upgrade needs
nothing but the migration that runs at boot. Rolling back means the previous
image; the table is harmless if left behind.

## Open Questions

- Whether the sweep should also run on the SQLite path, where a deployment is one
  long-lived process and the table is bounded by the addresses it has ever seen.
  Probably yes, for one behaviour rather than two.
