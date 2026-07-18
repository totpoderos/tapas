# End-to-end tests

Whole-system E2E tests (Playwright) that drive the running apps across
`host-web`, `participant-web`, and the API. These live at the repo root — not
inside a single workspace — because they span the whole system.

Playwright (with `axe-core` accessibility assertions) is wired up in **Phase 5**,
once there are real user flows to drive. See `openspec/changes/tapas-contest-app/tasks.md`.

Per-workspace tests (`unit`, `integration`, `acceptance`) live under each
package's own `tests/` folder, mirroring that package's `src/` tree.
