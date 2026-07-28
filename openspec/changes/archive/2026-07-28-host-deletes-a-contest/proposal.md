## Why

Nothing a host creates can ever be removed. A contest made by mistake, a duplicate, a test run before the real party, an event that was cancelled — all of it stays on the host's list forever, and every participant's name, dish and vote stays in the database forever with it.

There is no delete anywhere in the product today. `DELETE /drafts/:id` exists in the API but **nothing calls it** — not the host app, not any assistant tool — so in practice a host cannot remove even an empty draft they made by accident.

That is also a data-protection gap, not just an annoyance. A contest holds people's names and how they rated each other's cooking. The host is the only one who can act on that, and they have no way to.

## What Changes

- **A host can delete any contest they own, at any point in its life** — a draft still being written, a contest running with people voting right now, one that has closed, or one whose results are out. There is no state in which a host is stuck with a contest.
- **Deleting really deletes.** The contest, its roster, its dishes, its votes and scores, and its recorded history are all destroyed. What survives is a single tombstone entry: this host deleted this contest, at this time, having confirmed it. The names and the ratings are gone; the fact that a deletion happened is not.
- **The confirmation matches what is at stake.** Deleting is irreversible and there is no undo, so it always goes through a confirmation. Once anyone has claimed a place or cast a vote, the host must type the contest's name to unlock it — the same guard scale as the existing close and reveal confirmations, but stronger for the one action that destroys other people's work.
- **A participant caught mid-vote is told plainly.** Someone scoring on their phone when the host deletes the contest is told it is gone, rather than being shown a generic failure or a frozen screen.
- **The assistant can delete too**, as a destructive tool gated by the server-issued confirmation the host must approve — the same flow already used for closing a contest and triggering a reveal.
- **BREAKING (internal):** `DELETE /drafts/:id` is absorbed into the single delete. A draft and the contest it becomes share one id, so one host-facing action covers both. Two routes for one intent is precisely the shape behind the defects recorded in `docs/threat-model.md` §4, and there is no consumer to break.

## Capabilities

### New Capabilities

- `delete-a-contest`: a host destroys a contest they own and everything in it, at any point in its life, behind a confirmation proportionate to what is being destroyed — leaving an unforgeable record that the deletion happened, and telling anyone still voting that it is gone.

### Modified Capabilities

None. `audit-log-visibility` keeps every requirement it has: a host reads the history of a contest they own, and a deleted contest is simply no longer theirs to read — it is refused exactly as any other contest they do not own would be. `manage-live-contest` and `create-contest` are untouched; this adds a way out of the lifecycle rather than changing any step within it.

## Impact

- **API** — one new host-scoped delete covering drafts and published contests alike; `DELETE /drafts/:id` retired into it. A new use case that destroys a contest across every table that holds part of it, in one transaction, and records the tombstone.
- **Persistence** — the first delete paths on the contest, roster, dish, vote-session and audit repositories. Only `DraftRepository` has one today. The contest's join code is freed for reuse, which the unique index currently prevents while the row exists.
- **Audit** — the one place in the system where the log is *reduced* rather than appended to. This is a deliberate exception to "the log is append-only", made because the log itself stores participant names inside recorded draft content — so deleting a contest without it would not actually delete anyone's data. The exception is narrow, host-owned, and leaves a tombstone; it needs writing up in `docs/threat-model.md` alongside the reasoning.
- **Host app** — a delete action on the contest list and in the control room, with the typed-name confirmation. The existing `ConfirmDialog` is private to `contest-control.tsx` and moves into `@tapas/ui` to serve both.
- **Participant app** — handles a contest disappearing underneath it, on the screens that poll.
- **MCP** — a `delete_contest` tool, destructive, confirmation-gated.
- **Not included** — no recovery, undo, or trash. A host who deletes has destroyed it. No admin-side deletion, and no bulk delete.
