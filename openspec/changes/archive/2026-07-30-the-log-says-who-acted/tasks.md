# Tasks

## 1. The record says how an action arrived

- [x] 1.1 Acceptance scenarios written first, in `packages/api/tests/acceptance/reading-a-contest-audit-log.feature`, and confirmed before implementing: the assistant renaming a draft is recorded as a connected tool with the tool's name and the name it was asked for; the same rename in the app is recorded as the app's with no tool; both in one history are distinguishable; the actor stays the host; a confirmed close through the assistant is both connected-tool and host-confirmed. All six failed for the right reason before any wiring existed.
- [x] 1.2 Carry provenance across the dispatch. **`AsyncLocalStorage` was the plan and does not work**: `app.inject` goes through light-my-request, which crosses a stream boundary that drops the async context — probed and confirmed before building on it. What ships is a ticket: `dispatchedAs()` holds the provenance in-process against a random id and passes only that id as a header, so model-produced JSON still never becomes one. The entry is dropped in a `finally`. Unit-tested for the default, for the arguments not appearing in any header, for expiry after the dispatch and after a throw, for two concurrent dispatches, and for a made-up ticket meaning nothing.
- [x] 1.3 Thread it through the draft routes (`POST /drafts`, `PATCH /drafts/:id`, `PUT /drafts/:id`), read the way `hostConfirmed(request)` already reads the confirmation header.
- [x] 1.4 Widen `CreateDraft` / `RenameDraft` / `UpdateDraft` from a bare `sourcePath` to an `AuditProvenance`, keeping the app as the default so a direct call is unchanged. `AuditProvenance` and `IN_APP` live beside `AuditContext`, which already had room for the tool name and arguments.
- [x] 1.5 Thread it through the contest routes that record — close, reveal, delete — which hard-coded `sourcePath: 'form'`. Delete's comment is corrected rather than deleted: it now says what is still true, that an **external MCP client holding a PAT** cannot be told from an in-app session, and stays accountable through the security event log.
- [x] 1.6 Slice verification: 1945 unit tests, typecheck, lint, `openspec validate --strict`, 230 browser tests whole *and* file-by-file across the four specs this touches.

## 2. The panel stops describing a state it cannot reach

- [x] 2.1 `tests/e2e/host-activity-log-panel.spec.ts` drives the whole loop in a browser — the host asks the assistant to close a contest, confirms, then narrows the log to **Connected tool** and finds the closing there. The first time that filter has ever matched a row.
- [x] 2.2 The same test asserts the row still says the host is the actor and that they confirmed it, and that narrowing to **In-app** excludes it while including what the host did directly. Provenance must not be bought at the cost of either.
- [x] 2.3 The exported file needs no change: its `source` column is the same field, now populated. Covered by the export spec continuing to pass.

## 3. What this change does not do

Recorded as prose, not as an unchecked task. A non-goal written as a checkbox is
one that can never be ticked: it makes a finished change read as unfinished and
stops it being archived. The limitation itself is stated where it belongs — in
the proposal, in design.md's Non-Goals, and in the code comment it replaced.

**Provenance for the MCP server transport is out of scope.** It does not pass
through the assistant's dispatch, and the API deliberately cannot tell a
PAT-authenticated session from an in-app one, so its actions keep being recorded
as the app's and stay accountable through the security event log. It wants its
own change.
