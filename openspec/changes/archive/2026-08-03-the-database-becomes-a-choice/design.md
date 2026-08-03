# Design — The database becomes a choice

## Context

`packages/api/src/db` holds 13 repositories over `node:sqlite`'s `DatabaseSync`.
Every method is synchronous — **zero** `async` in any of the 13 files — so every
use case that calls one is synchronous too, and only the routes above them are
async. A network database is asynchronous by nature, so the shape of the whole
data path changes whichever one is chosen.

What does *not* change is the SQL. The migrations were written for this
(`migrate.ts`: "Postgres-ready — the SQL avoids SQLite-only constructs"), and a
search for dialect-specific constructs across `src/db` and all 19 migrations
returns exactly one line, the `PRAGMA` in `openDatabase`. The partial index that
caps administrators at one, and both `ON CONFLICT … DO UPDATE` upserts, are
supported by both databases.

The surface the repositories actually use is small enough to count:

| | |
|---|---|
| `db.prepare(sql)` → `.run` / `.get` / `.all` | 17 sites |
| `db.exec(sql)` | 9 sites |
| transactions, via `exec('BEGIN' / 'COMMIT' / 'ROLLBACK')` | `unit-of-work.ts` |

## Goals / Non-Goals

**Goals:**

- A deployment chooses its database in configuration, and both work.
- One set of SQL, one set of repositories, one acceptance suite.
- The async conversion is verifiable on its own, before any new database exists.

**Non-Goals:**

- Any change in behaviour. This change is a success only if every existing spec
  still passes, unmodified, under both databases.
- The serverless deployment shape, and the rate limiter. Both are named in the
  proposal as separate changes.
- An ORM or query builder. The SQL is already portable; replacing hand-written
  statements with a library would be a much larger change justified by nothing
  this change needs.

## Decisions

### 1. The strategy sits at the driver, not at the repository

A `Database` port with two adapters, not two implementations of each of the 13
repository interfaces.

*Alternative considered:* a strategy per repository —
`PostgresHostAccountRepository` beside `SqliteHostAccountRepository`, thirteen
times. Rejected: it duplicates every one of ~189 statements, and two bodies of
SQL that are only ever exercised separately is the exact shape
`docs/threat-model.md` §4 names as this project's recurring lesson. The
validation gap between the MCP server and the in-app assistant was that shape;
so was the Chromium/WebKit cookie defect. Building a third one deliberately, to
save writing one adapter, would be a poor trade.

The port is the three rows in the table above and nothing else. Anything a
repository cannot express through it is a signal the concern belongs elsewhere.

### 2. Async first, with the database held constant

Slice A turns the data layer async while still on SQLite, wrapping `DatabaseSync`
in a port whose methods return already-resolved promises.

This is the whole risk-management story of the change. The conversion touches 13
repositories, 48 use-case files and 53 call sites in routes — far more than the
Postgres adapter itself — and doing both at once means every failure has two
possible causes. Done this way, the existing 2400-odd tests are the oracle: they
pass before, they pass after, and nothing about the database has moved.

It also means the port and its first adapter arrive together, so the Postgres
adapter is strictly additive rather than a replacement.

### 3. Each adapter owns its own differences

| | SQLite | Postgres |
|---|---|---|
| Placeholders | `?` passes through | rewrite `?` → `$1…$n` |
| Connection | one handle | a pool; **one connection pinned** for a transaction |
| Opening | `PRAGMA journal_mode`, `foreign_keys` | connection string |

The placeholder rewrite is deliberately a translation inside one adapter rather
than a rewrite of 189 statements. It keeps the statements single-source, which is
decision 1 restated at the level where it would otherwise quietly be broken.

### 4. The suite runs against both, and that has to be one command

The acceptance specs are parameterised over the adapter. SQLite stays the default
because in-memory is what makes 2400 tests bearable; Postgres runs on demand and
before a deploy.

A guarantee nobody can run is not a guarantee. With CI disabled, "run the suite
against Postgres" has to be one command, named in the README, or it will be
skipped exactly when it matters.

### 5. Configuration says it the way the mail transport says it

`DATABASE_DRIVER=sqlite|postgres`, validated in `env.ts`, refusing anything else
at boot — beside `MAIL_TRANSPORT=smtp|none`, which is the same shape of decision
and was settled the same way. A deployment reads one file and sees both of the
choices it gets to make.

### 6. Migrations run once, whoever starts first

`migrate.ts` becomes async. Under Postgres, more than one instance may start at
the same time, so the runner takes an advisory lock before applying anything.
Under SQLite there is one process and the lock is a no-op.

## Risks / Trade-offs

- **The SQL is locked to the intersection of both dialects, permanently.** No
  `jsonb`, no `ILIKE`, no Postgres-only index types — not because they are hard,
  but because SQLite would stop working the day one is used. Today this costs
  nothing; the SQL is already in the intersection. It is a standing constraint on
  every future query and is accepted here so that nobody meets it as a surprise.
- **Two paths to prove equivalent** → the shared acceptance suite, run against
  both. This is the mitigation the whole change rests on; if it is not run, the
  change has created the very thing decision 1 avoided.
- **The async conversion is large and touches almost everything** → it is done
  alone, against a green suite, with no second variable.
- **A pooled transaction that forgets to pin its connection** commits half a
  change and looks fine in every single-user test → covered by a spec about
  concurrent work, not only by one about failure.
- **Row types differ subtly** (what comes back for an integer, a null, a date) →
  the repositories already map rows explicitly; the suite running against both is
  what catches anything they get wrong.

## Migration Plan

Slice A is behaviour-preserving and ships on its own. Slice B adds an adapter
nothing selects yet. Only slice C makes the choice reachable, and the default
stays SQLite — so at no point is an existing deployment changed by upgrading.

Rollback is the setting.

## What the second run actually costs

Measured on this machine, whole suite, 2482 tests:

| | |
|---|---|
| SQLite, in memory | **30s** |
| Postgres, local Docker | **37s** |

About a quarter slower, not the order of magnitude that would have made "run both
before a deploy" a rule nobody follows. Migrating once per worker rather than
once per spec is what buys that; creating a database per spec was the version
that would have cost minutes.

Worth reading with two caveats. It is a Postgres on the same machine, so the
number contains no real network — a hosted database will be slower, and by how
much is a property of the hop rather than of this code. And SQLite stays the
default precisely because 30s is what makes the suite something to run on every
save; the Postgres pass is for before a deploy, not for every keystroke.

## Open Questions

- Whether the Postgres adapter should use a serverless HTTP driver or an ordinary
  pooled client. It depends on where the API ends up running, which this change
  deliberately does not decide. The port makes it a later, contained choice.
- Whether E2E should also run against Postgres, or stay on the default. It boots
  the API as a real process, so it can do either; the cost is wall-clock on an
  already 9-minute suite.
