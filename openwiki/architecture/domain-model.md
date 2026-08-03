# Domain model — the rule space and its compiler

The full ubiquitous-language glossary (every domain term, its canonical code
identifier, and its definition) lives at
[`openspec/changes/archive/2026-07-28-tapas-contest-app/glossary.md`](../../openspec/changes/archive/2026-07-28-tapas-contest-app/glossary.md).
This page explains the shape of `packages/domain` and why it's built the way it
is; treat the glossary as the canonical name reference and this page as the
"why" companion.

## The rule space

A contest is not one product — it's a point chosen across five independent
dimensions, all defined in `packages/domain/src/model.ts`:

| Dimension | Type | Values |
|---|---|---|
| Format | `ContestFormat` | `solo` (everyone alone) · `solo_with_partners` (alone, but a partner is barred from scoring you) · `couples` (a couple cooks one dish together) |
| Anti-bias | implied by format + `partnerId` | who may not score whom — settled entirely by format + partner links, no separate rule to keep consistent |
| Scoring range | `ScoreRange` | `fixed { min, max }` or `auto` (resolves per-judge to `1..N`, a ranking) |
| Uniqueness | `ScoringConfig.uniquePerCategory` | `true` = strict permutation (each score used once per category) · `false` = repeats allowed |
| Categories | `ScoringConfig.categories` | host-configurable scored dimensions (e.g. Presentation, Originality, Taste); no weights in v1 |

One value (`ContestFormat`) intentionally settles *two* concerns (who cooks
together, who may not score whom) — see the doc comment on `ContestFormat` in
`model.ts` for why: it avoids a second rule that could disagree with the first
(e.g. a `couples` contest can never need an explicit "don't let partners score
each other" rule, because a partner's dish *is* your own dish, which nobody
scores in any format).

## Draft → Contest: the lifecycle

- **`Draft`** (`packages/domain/src/draft/draft.ts`) is the mutable, pre-publish
  configuration aggregate. It owns exactly one invariant while still a draft: it
  must have a name, and if a format is set at all it must be one of the three
  known formats (`checkFormat`) — checked in the domain so *every* way in (form,
  API, MCP tools, assistant) is held to it, rather than an unknown value being
  stored and only discovered at publish time.
- **Publish** (`Contest.publish`, `packages/domain/src/contest/contest.ts`) is
  the pivotal transition: it requires the draft to name all three of format,
  participants, and scoring — if any is missing, `PublishError` explains, **in
  the host's own words**, exactly which piece is still needed. This replaced an
  earlier version that reported the same generic sentence whichever piece was
  actually absent, which sent hosts to "fix" a scoring config that was already
  complete.
- **What a draft still needs** is `stillNeeded`
  (`packages/domain/src/draft/still-needed.ts`), which answers the list of
  things a draft has not said yet. It lives beside `DraftContent` rather than
  inside publishing because it is a question about a draft: anyone may ask it
  without trying to publish, and a draft's details carry it so a host reads what
  is left while they can still act on it. Publishing writes its refusal sentence
  from the same list, so the two cannot drift — a draft that reads as ready
  cannot then be refused as incomplete.
- If the draft is complete, publishing calls **`compile()`** and, on success,
  produces an immutable `Contest`, pairing the compiled `MaterializedContest`
  with a generated join code and default `CloseRule`/`RevealStrategy` if the
  draft didn't specify them.

## `compile()`: the pure function everything else trusts

`packages/domain/src/compile.ts` is the single most load-bearing piece of domain
code: `compile(ContestDraft) → MaterializedContest | CompileError`. It has
**zero I/O** — no DB, no network, no LLM — enforced by an ESLint rule scoped to
the whole `domain` package. That purity means:

- It can be tested exhaustively, including with **property-based tests**
  (`fast-check`), with no infrastructure at all.
- The rule language is compiled *once*, at publish, into a
  `MaterializedContest`: `dishes[]` (with `submitterIds`), `allowedVoters` (a
  map from dish → the set of people allowed to score it),
  `scoreRangeByVoter` (bounds per judge), and `uniquePerCategory`/`categories`.
- The runtime **never re-interprets the rule language** after publish — every
  downstream check (can this voter score this dish? what score range is valid
  for them?) is a lookup against the materialized view, not a re-evaluation of
  the original rules. This is also what lets the participant score screen adapt
  itself to the compiled shape, making an invalid score impossible to enter in
  the UI in the first place.

If you're changing the rule space (a new format, a new anti-bias mode, a new
scoring dimension), `compile()` and its `CompileError` codes are where that
logic belongs — not in a use case, not in a route handler.

## Scoring and votes

- **`VoteSession`** (`packages/domain/src/scoring/vote-session.ts`) is a voter's
  scoring session for one contest: status `draft` → `sent`. It is the
  consistency boundary for vote invariants — scores are freely editable while
  `draft`, and **`sendVote` is a one-way lock**: there is no edit-after-send in
  v1, so the pre-send confirmation UI is the actual safety net, not a formality.
- **`checkScore`** (`packages/domain/src/scoring/score-check.ts`) validates a
  single score against the `MaterializedContest`'s compiled bounds — this is the
  runtime enforcement point referenced above.

## Auth-adjacent domain rules

`packages/domain/src/auth/` holds domain rules that are pure but security-relevant:
`Email` value-object validation, `checkPasswordStrength`/`MIN_PASSWORD_LENGTH`,
`HostAccount` (with `MAX_FAILED_ATTEMPTS`/`LOCK_DURATION_MINUTES` for account
lockout), and invitation expiry (`INVITATION_LIFETIME_HOURS`). These are kept in
`domain` rather than `api` for the same reason as the compiler: they're pure
rules worth unit-testing without a database.

## Where to look when changing the rule space

1. `packages/domain/src/model.ts` — add/change the value objects.
2. `packages/domain/src/compile.ts` — teach the compiler the new shape; this is
   where almost all the actual logic and edge cases live. Check
   `packages/domain/tests/unit/compile.test.ts` for the property-based test
   suite style to extend.
3. `packages/domain/src/contest/contest.ts` and `draft/draft.ts` if the new
   dimension changes what "complete enough to publish" means.
4. The relevant `openspec/specs/*/spec.md` capability doc, and — if the change
   is user-facing — a new `openspec/changes/<slug>/` proposal following the
   spec-driven workflow described in [`docs/backlog.md`](../../docs/backlog.md).
5. Both frontends' scoring/draft UI and the MCP `tool-catalog.ts` input schemas,
   since the rule space is surfaced through the form, the chat draft flow, and
   MCP tools alike.
