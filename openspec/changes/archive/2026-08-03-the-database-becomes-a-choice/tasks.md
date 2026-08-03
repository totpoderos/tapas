# Tasks — The database becomes a choice

Three slices, each its own PR. Slice A changes no behaviour and no database and
must leave the suite exactly as green as it found it. Slice B adds an adapter
nothing selects. Slice C makes the choice reachable.

## 1. Slice A — the data layer becomes async, still on SQLite

- [x] 1.1 Define the `Database` port: `prepare(sql)` answering `run`/`get`/`all`,
      `exec(sql)`, and a transaction that runs a function against one connection.
      Nothing wider — the 17 prepare sites and 9 exec sites are the whole surface.
- [x] 1.2 Implement it over `node:sqlite`, returning already-resolved promises,
      and move the `PRAGMA` line into it. This adapter is where every SQLite-only
      thing now lives.
- [x] 1.3 Turn the 13 repositories async behind their unchanged interfaces, then
      the use cases that call them, then the 53 call sites in routes. Interfaces
      keep their names and their shapes; only the return types gain a promise.
- [x] 1.4 Make `unit-of-work.ts` run a function inside a transaction rather than
      exposing begin/commit, so the pinned-connection rule has somewhere to live
      in slice B.
- [x] 1.5 Green the full suite unchanged — same specs, same count, same
      assertions. A spec that had to be edited to pass is a behaviour change and
      belongs in a different PR.

## 2. Slice B — a Postgres adapter behind the same port

- [x] 2.1 Write the acceptance-suite parameterisation first: one command runs the
      specs against a named adapter, and it is red for Postgres before the
      adapter exists.
- [x] 2.2 Implement the Postgres adapter: pooled client, `?` → `$1…$n` rewriting,
      and a transaction that pins one connection for its whole life.
- [x] 2.3 Make `migrate.ts` async, and take an advisory lock under Postgres so
      two instances starting together cannot both apply the same migration.
- [x] 2.4 Run the migrations against a real Postgres and fix what the schema
      actually rejects. **Nothing was rejected**: all 19 apply unchanged,
      including the partial unique index that caps administrators at one. The
      claim held. What the *suite* then found was two differences the schema
      could not show — see design.md.
- [x] 2.5 Green the acceptance suite against Postgres, and keep it green against
      SQLite. Both, every time, from here on.
- [x] 2.6 Write down how to run it — one command, in the README, beside the other
      gates. With CI disabled, a guarantee nobody can run is not a guarantee.

## 3. Slice C — the choice, and the deployment that uses it

- [x] 3.1 Add `DATABASE_DRIVER=sqlite|postgres` to `env.ts`, defaulting to
      `sqlite` and refusing anything else at boot, beside `MAIL_TRANSPORT`.
- [x] 3.2 Select the adapter in the composition root, the one place every
      implementation is already chosen.
- [x] 3.3 Replace `DATABASE_PATH` with a connection setting under Postgres, and
      extend the guard test so `.env.prod.example` still offers everything the
      manifests require.
- [ ] 3.4 Point a real Neon database at it by hand and drive the whole journey.
      **NOT DONE, and archived open on purpose.** It needs a hosted account,
      which is the host's to create. What the suite already proves is the part
      that was actually in doubt: every statement, every migration and both
      transaction paths against a real Postgres, 2482 tests. What stays unproven
      is everything the wire adds — the latency of a round trip that is not on
      this machine, whether the pool behaves against a database that closes idle
      connections, and how a free tier's cold start feels to somebody waiting.
      None of that is a property of this code, which is why the change closes
      without it; all of it is a property of the first real deployment, which is
      when it will be found.

## 4. Close out

- [x] 4.1 Full local gate under both databases, plus typecheck, lint and
      `openspec validate --strict`.
- [x] 4.2 Record in `design.md` what the Postgres run actually cost in wall-clock
      against the in-memory one, so the next person choosing a default knows.
- [x] 4.3 Archive the change.
