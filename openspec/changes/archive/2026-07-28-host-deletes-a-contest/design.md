## Context

Nothing in Tapas can be deleted. `DraftRepository` is the only repository with a `delete()` (`packages/api/src/db/draft-repository.ts:75`), reached by `DELETE /drafts/:id` — an endpoint with **no consumer**: the host app never calls it and there is no MCP tool for it. Contests, roster, dishes, vote sessions and scores have no delete path at all.

A published contest is spread across five tables that do not cascade, plus the audit log:

```
contests ──┬─ persons        (contest_id, participant_id, display_name)
           ├─ dishes         (contest_id, dish_id, …)
           ├─ vote_sessions ── scores   (via vote_session_id)
           └─ audit_log      (contest_id, before_json, after_json)
```

Two facts about the existing schema drive most of what follows.

**A draft and the contest it becomes share one id.** `PublishContest` compiles the draft, inserts a contest with `draft.id`, and deletes the draft row (`publish-contest.ts:48`). So a single id identifies one thing across its whole life, and one delete can address it whatever stage it is in.

**The audit log stores participant names.** `draft.saved` records the entire `DraftContent` in `before_json` / `after_json`, participants included. Deleting the contest tables while leaving the log intact would therefore *not* delete anyone's data — it would only look like it had.

The host is the only actor who can act on any of this, and the confirmation machinery they would need already exists in two forms: a focus-trapped `role="alertdialog"` used for close and reveal (private to `contest-control.tsx:191`), and the server-issued HMAC confirmation token that gates destructive MCP tools (`packages/mcp/src/confirmation-token.ts`).

## Goals / Non-Goals

**Goals:**

- A host can get rid of a contest at any stage, with no state that traps them.
- What is deleted is genuinely deleted, including the personal data recorded about it.
- The fact that a deletion happened survives the deletion.
- The guard against an accidental delete is enforced where it cannot be skipped — not only in the screen that shows it.
- Someone taking part when it happens finds out, rather than staring at a spinner.

**Non-Goals:**

- No undo, no trash, no recovery window. A deleted contest is destroyed.
- No admin-side or operator deletion, and no bulk delete. This is one host, one contest they own.
- No retention policy, scheduled purge, or automatic expiry of old contests.
- No change to any step *within* the lifecycle — publish, close and reveal are untouched.

## Decisions

### One delete for drafts and contests, not two

`DELETE /contests/:id` resolves the id against a draft **or** a published contest and deletes whichever it finds. `DELETE /drafts/:id` is retired into it.

The alternative — keeping the draft route and adding a contest route, with the host app choosing by status — was rejected. One host intent reached by two routes, each with its own ownership check, is the exact shape behind all three defects recorded in `docs/threat-model.md` §4 (MCP vs assistant on validation, form vs assistant on participant ids, fixture vs real resources on translations). Every one of them shipped green.

```
   two routes                        one route
   ─────────────────────────         ─────────────────────────
   DELETE /drafts/:id                DELETE /contests/:id
   DELETE /contests/:id                    │
     caller picks by status          resolves draft-or-contest
     two ownership checks            one ownership check
     guard can hold on one           guard cannot be routed around
```

The cost of unifying is near zero here precisely because the draft route has no consumer to migrate. The ids already share a space, so resolution is a lookup in each of two repositories.

### Delete the history, leave a tombstone

Deleting a contest deletes its `audit_log` rows and then appends exactly one: `contest.deleted`, carrying the actor, the time, the source path and `confirmation: 'host'` — and **no** `before` or `after` payload.

This is a deliberate, narrow exception to the rule that the audit log is append-only, and it is the only such exception in the system. It exists because of the schema fact above: the log holds the participant names inside recorded draft content, so a delete that spares the log erases nothing that matters. Given a choice between an audit trail that is complete and a deletion that is real, the deletion wins here — a host acting on their own contest's personal data is exactly the case where erasure is the point. What is kept is the accountability that OWASP A09 actually asks for: *that* a destructive act occurred, by whom, when, and confirmed.

Rejected alternatives:

- **Keep the whole log.** Orthodox, and dishonest — the UI would say "deleted" while the names remained.
- **Delete the log entirely, no tombstone.** Erasure with no accountability, and it removes the ability to tell a deleted contest from one that never existed — which the participant-facing behaviour below depends on.
- **Soft delete (`deleted_at`).** Cheapest to build and fully recoverable, but it erases nothing, keeps the join code taken, and turns every read path in the system into "…and not deleted" — a condition that will eventually be forgotten in one of them.

This decision needs writing into `docs/threat-model.md` beside the §4 material, because a future reader finding a `DELETE FROM audit_log` will otherwise be right to be alarmed.

### The former owner gets 404; a participant gets 410

After the contest row is gone there is no `host_id` left to authorize against, so the system **cannot distinguish its former owner from a stranger**. The host therefore gets `CONTEST_NOT_FOUND` on everything about a deleted contest, including its history. This is forced by the design, not chosen: the alternative is retaining the owner id, which is retaining the contest.

A participant is different. Their voter token is scoped to that `contestId`, so possession of it already proves prior association — telling them the contest is gone reveals nothing they did not know. Voter-scoped routes therefore answer `410 Gone` with a `CONTEST_DELETED` code when a tombstone exists for the id, and `404` otherwise. The participant app turns the 410 into a plain "this contest is gone" on the dish, scoring and waiting screens, and stops polling.

The join-by-code path cannot reach this at all: the code was freed with the row, so a stale code is simply no such contest.

### The typed-name guard lives in the API

For a contest anyone has joined or voted in, the delete request must carry the contest's name — `DELETE /contests/:id?confirm=<name>` — and the API refuses without a match. The threshold is participation, not status: a claimed place or a cast vote means someone else's work is at stake.

Putting this only in the dialog would make it a property of one screen, leaving the assistant and any MCP client able to delete a live contest in one step. That is the same asymmetry as above, so the rule is enforced at the one place all three entry points pass through. The query parameter follows the existing precedent of `DELETE /drafts/participants?contest=…&participant=…`; a request body on DELETE is avoided.

Because the MCP tool's arguments then include the name, the HMAC confirmation token is bound to it too — a token minted for deleting *this* contest cannot delete another.

### One transaction

The delete spans five tables and the log. It runs inside a single `BEGIN` / `COMMIT` / `ROLLBACK`, following `migrate.ts:39`, so a failure part-way cannot leave a contest with its votes destroyed and its row intact. The use case takes a unit-of-work collaborator rather than each repository opening its own transaction.

The acceptance tests run against real in-memory SQLite, which is what makes this checkable — the `UNIQUE` constraints and the freed join-code index are load-bearing here in the same way they are for scoring.

### `ConfirmDialog` moves to `@tapas/ui`

It is currently a private function inside `contest-control.tsx`. Delete appears both on the contest list and in the control room, so it moves up, gains an optional "type this to confirm" mode, and `contest-control.tsx` keeps using it for close and reveal unchanged.

The in-flight `host-sees-the-results` change is also moving a component into `@tapas/ui`. These should not land simultaneously in the same file set — sequence them.

## Risks / Trade-offs

- **A `DELETE FROM audit_log` is a serious-looking line of code.** → It is reachable only from the delete use case, only for a contest the caller owns, and only after the confirmation gate. Write the reasoning into `docs/threat-model.md`, and add a test that asserts the tombstone survives and the payloads do not — so the exception stays exactly as narrow as designed.

- **The confirmation token is replayable.** `confirmation-token.ts` documents this: it is a deterministic HMAC over the tool and its arguments, with no nonce store. A token for `delete_contest(X)` always validates. → The blast radius is bounded by the target already being gone: a replay hits `CONTEST_NOT_FOUND`. The action is destructive but not repeatable, so the token's known weakness does not compound here. Worth naming in the write-up rather than discovering later.

- **A moved `ConfirmDialog` can lose its accessibility.** → The dialog is focus-trapped, Escape-cancelling, `role="alertdialog"` with bound title and body. The typed-name field adds a labelled input inside a trap, which is where focus order tends to break. Keep the existing close/reveal tests green through the move and add axe coverage for the typed variant, including that the field is properly labelled and its error is announced.

- **A shared component asking for translations an app has not got.** → `@tapas/ui` resolves keys against whichever app renders it, and i18next answers a missing key by echoing the key — announced aloud when it lands in a label. This has happened here before (`LanguageSelect` reading out "language.label"). Use full key paths with English defaults and assert against the **real** app resources.

- **Deleting is the highest-stakes thing the assistant can do**, and the assistant reads participant-supplied text. → The existing defences apply unchanged (the deterministic guard over injected rules, plus the confirmation gate), and the typed-name requirement means the model must reproduce the contest's name for anything anyone has joined. Rate-limit it as the security context requires for destructive tools.

- **A participant mid-send when the delete lands.** → The vote is refused and nothing is recorded; the app tells them the contest is gone rather than offering a retry that cannot succeed.

## Migration Plan

Additive except for one retirement. New delete methods on five repositories, one new use case, one new route, one MCP tool, one moved UI component. No schema migration is required — deletion needs no new column, which is one of the advantages of not going the soft-delete route.

`DELETE /drafts/:id` is removed in the same change. It has no caller in either app and no MCP tool, so nothing migrates; its use case (`DiscardDraft`) is absorbed by the new one.

Rollback is removing the route, the tool and the UI entry points. Deletions already performed are, by construction, not recoverable — which is the point, and the reason the confirmation gate is the part to get right first.

## Open Questions

- Whether the tombstone should be readable by anyone at all through the product. It is currently reachable only in the database, since the host's audit route cannot authorize a contest that no longer exists. That is coherent, but it means the accountability record has no reader inside the app — an operator concern that may want a home later.
- Whether "participation" is the right threshold for the typed-name guard, or whether it should simply be "published". Claimed-or-voted is the more precise measure of whether anyone else has invested anything; published is the simpler rule to explain to a host.
- Whether the participant app should distinguish "the host deleted this" from "this contest ended" in what it says. The 410 carries enough to do so; whether it is kind to is a copy decision.
