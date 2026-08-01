## Why

A host setting up a contest currently answers two separate questions — how dishes
are attributed (per person / per couple) and what guards against bias (nobody /
couples / chosen pairs) — and then fills in two separate lists of people (partners,
and pairs barred from scoring each other). That is a 2×3 grid plus two rosters, and
only three of its cells describe a contest anybody actually holds. The rest are
combinations nobody wants, and the screen has to spend its space explaining them:
the barred-pairs card carries a standing "these pairs are not in force" warning, and
the spec carries a whole requirement (`prepare-a-contest`, "A rule that is being
recorded but not applied says so") whose only job is to apologise for a setting that
does nothing. A host has to hold the grid in their head to know what they have set.

There are only three contests:

1. everybody cooks their own dish and scores every dish but their own;
2. the same, except some people have a partner, and a partner's dish is not theirs to score;
3. each couple cooks one dish together, everybody is in a couple, and nobody scores their own couple's dish.

So the contest should ask one question with three answers, and the rest should follow.

## What Changes

- **BREAKING** — A contest being prepared has a single **format** in place of `attribution` and `antiBias`, with three values:
  - `solo` — each person cooks their own dish; everybody scores every dish but their own.
  - `solo_with_partners` — each person cooks their own dish; a partner is optional, and whoever has one does not score their partner's dish.
  - `couples` — each couple cooks one dish together; everybody must have a partner; nobody scores their own couple's dish.
- **BREAKING** — The "chosen pairs cannot score each other" rule is removed outright: the `arbitrary_pairs` anti-bias value, a participant's `noScoreWith` list, the barred-pairs card and its pair picker, and the "not in force" callout all go. A **partner** becomes the only way two people are kept apart.
- **BREAKING** — The `couples` format no longer lets an unpartnered person cook alone among the couples. Publishing is refused while anybody lacks a partner, and the publish checklist says how many still do.
- **BREAKING** — `attribution` and `anti_bias` are replaced on the wire, in the draft, and in storage by `format`. No mapping migration: there is no stored contest worth preserving.
- The partner field on the participants section follows the format: absent under `solo`, offered under `solo_with_partners`, required under `couples`.
- The requirement "A rule that is being recorded but not applied says so" is removed. Nothing recordable is ever idle, so nothing needs apologising for.
- The assistant and the MCP tool surface extract and edit a `format` rather than two fields; a participant's name still cannot set it.

## Capabilities

### New Capabilities

None. This replaces how an existing capability is configured rather than adding one.

### Modified Capabilities

- `prepare-a-contest`: the rules section offers one format instead of attribution and anti-bias; the barred-pairs card and the idle-rule requirement are removed; the checklist reports missing partners only under `couples`.
- `create-contest`: a draft is saved with a format; the assistant may not default it, and a participant's name may not set it.
- `contest-management-api`: a draft's format is what a host edits over the API; "which participants may not score each other" is no longer editable because it no longer exists; listing and reading a contest report its format in place of its attribution and its anti-bias rule.
- `validate-and-publish-contest`: publishing a `couples` contest is refused while anybody is unpartnered.
- `read-my-ballot`: what is kept off a ballot is stated in terms of the format.
- `submit-dishes`: partners share one submission under the `couples` format specifically, not under an attribution setting.

## Impact

- `packages/domain`: `Attribution` and `AntiBias` value objects replaced by `ContestFormat`; `Person.noScoreWith` removed; `compile()` loses its `arbitrary_pairs` branch and its no-score map, and gains a `couples`-format check that everybody is partnered; `CompileErrorCode` loses nothing and gains `UNPARTNERED_IN_COUPLES`.
- `packages/api`: draft and contest DTOs, the draft-extraction tool schema and its guard, the publish use case, the materialized codec, and the persistence columns (`attribution`, `anti_bias` → `format`) via a new migration.
- `packages/host-web`: the rules section's two radio groups become one; the participants section loses the barred-pairs card and its picker; the publish checklist changes what it counts; EN and ES copy for all of it.
- `packages/participant-web`, `packages/ui`, `packages/mcp`, `packages/evals`: the shared DTO, the tool catalog, and the creation eval cases follow the same rename.
- Acceptance features across `packages/api/tests/acceptance`, `packages/domain/tests`, `packages/host-web/tests/unit` and the root `tests/e2e` are rewritten in terms of the three formats.
