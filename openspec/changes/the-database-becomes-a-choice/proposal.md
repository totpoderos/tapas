# The database becomes a choice

## Why

The API can only ever talk to SQLite on a local disk. That was the right call —
it is why the whole test suite runs in memory with real repositories and real
migrations, and why `npm run dev` needs nothing installed. It also means the
only place this app can be deployed is a machine with a persistent disk.

Deploying to a serverless platform needs a database reachable over the network.
Nothing about that is unique to one vendor, and the schema was written for it:
`migrate.ts` says "Postgres-ready — the SQL avoids SQLite-only constructs", and
it holds. A search of the whole codebase for dialect-specific SQL —
`AUTOINCREMENT`, `INSERT OR`, `json_*`, `datetime()`, `SERIAL`, `IFNULL`,
`GROUP_CONCAT` — returns exactly one line: the `PRAGMA` in `openDatabase`.
Everything else, including the partial index that caps administrators at one and
both `ON CONFLICT … DO UPDATE` upserts, is already common to both databases.

So this is a claim the project has been making in a comment and can now make in
a test. A deployment chooses its database; both behave identically; the same
acceptance suite proves it.

Keeping SQLite is not sentimentality. It is what keeps 2400-odd tests running in
memory in seconds, and it keeps the €4-box deployment available as the thing to
point at if the serverless one misbehaves on the day.

## What Changes

- The data layer becomes **asynchronous**, with SQLite held constant. This is the
  widest change in the project — 13 repositories, 48 use-case files, 53 call
  sites in routes — and doing it without changing databases means the existing
  suite must stay green throughout, so a failure has one possible cause instead
  of two.
- A **`Database` port** with the whole surface the repositories actually use:
  `prepare(sql)` answering `run`/`get`/`all`, `exec(sql)`, and a transaction. Two
  adapters implement it. The repositories keep one set of SQL and never learn
  which database they are on.
- A deployment **chooses** its database in configuration, beside the mail
  transport it already chooses. An unknown value is refused at boot.
- The acceptance suite **runs against both adapters** — the same specs, twice.
- **No behaviour changes.** Every requirement in every capability holds exactly
  as it does now; that they hold under either database is the point.

## Capabilities

### New Capabilities

- `choosing-the-database` — a deployment says which database serves it, both
  serve it identically, and the same specs prove it.

### Modified Capabilities

None. This changes no requirement of any existing capability. A capability whose
behaviour changed here would be a defect of this change, not a feature of it.

## Impact

- `packages/api/src/db` — the port, two adapters, and 13 repositories turned
  async behind unchanged interfaces.
- `packages/api/src` — every use case that reaches a repository, and the routes
  that call them.
- `packages/api/src/config/env.ts` — the setting, and its refusal of anything
  else.
- `packages/api/tests` — the harness gains a second database; the acceptance
  suite gains a way to be run against either.
- New dependency: a Postgres driver. No change to the domain, the compiler, the
  frontends, the MCP server, or the evals.

## Out of scope, deliberately

Two things this change makes possible but does not do, each its own change:

- **The serverless deployment shape** — a handler entry point instead of
  `.listen()`, and origin rewrites so API paths stay first-party.
- **The rate limiter.** `SENSITIVE_RATE_LIMIT` counts in one process's memory. On
  a platform that runs many instances it stops being a control, and it stops
  silently — the one thing on this list that fails without saying so. It needs
  either a shared store or an honest entry in the threat model, decided on its
  own terms rather than smuggled in here.
