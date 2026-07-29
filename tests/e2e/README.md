# End-to-end tests

Whole-system E2E tests (Playwright) that drive the running apps across
`host-web`, `participant-web`, and the API. These live at the repo root — not
inside a single workspace — because they span the whole system.

Playwright (with `axe-core` accessibility assertions) is wired up in **Phase 5**,
once there are real user flows to drive. See `openspec/changes/tapas-contest-app/tasks.md`.

## Docker is a prerequisite

`npm run test:e2e` starts a mail catcher (Mailpit) alongside the API and both
frontends, so **the Docker daemon must be running**. Playwright starts it via
`webServer` rather than CI starting it in a `services:` block, so a local run
and CI start it identically — a service only CI has is how the thing that is
tested drifts from the thing that ships.

Without Docker the run fails at start-up on the catcher's health check, rather
than silently skipping the specs that need mail.

The invitation specs read their link from the message that was actually sent,
via the catcher's REST API — never from the database, which holds only a hash of
the token.

Per-workspace tests (`unit`, `integration`, `acceptance`) live under each
package's own `tests/` folder, mirroring that package's `src/` tree.
