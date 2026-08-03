# Contest lifecycle workflow

The end-to-end journey the whole system is built around: **create → publish →
join → submit a dish → score → send → reveal.** Every step below is backed by an
OpenSpec capability under [`openspec/specs/`](../../openspec/specs) — follow the
links for the exact `Requirement`/`Scenario` wording (Gherkin-style, domain
language only, no implementation leakage) and by a whole-system Playwright E2E
spec under [`tests/e2e/`](../../tests/e2e).

## 1. Create — form or chat

A host creates a contest as a **`Draft`** two ways, both converging on the same
domain rules ([domain-model.md](../architecture/domain-model.md)):

- **Form path** — `packages/host-web/src/pages/new-contest.tsx` and
  `pages/draft/` walk the host through format, participants, and scoring
  directly, calling draft-shaping use cases
  (`packages/api/src/drafts/use-cases/`) one field at a time
  (`SetDraftFormat`, `AddScoringCategory`, `AddDraftParticipant`, ...).
- **Chat path** — the host describes the contest in natural language in
  `packages/host-web/src/pages/chat.tsx`; the **contest-creation LLM**
  (`packages/api/src/drafts/extraction/extract-contest-draft.js`) extracts a
  structured draft, which is then **re-validated by the API** before anything is
  stored. See [integrations/ai-surfaces.md](../integrations/ai-surfaces.md) for
  how this surface is measured.

Spec: [`openspec/specs/create-contest/spec.md`](../../openspec/specs/create-contest/spec.md),
[`configure-contest`](../../openspec/specs/configure-contest), [`prepare-a-contest`](../../openspec/specs/prepare-a-contest).

## 2. Publish

`PublishContest` (`packages/api/src/contests/use-cases/publish-contest.ts`)
requires the draft to have format, participants, and scoring all set; if not,
the host is told **in their own words** exactly which piece is missing. A draft
also reports what it still needs *before* anyone tries to publish it — the same
judgement, asked earlier (`stillNeeded`, see
[domain-model.md](../architecture/domain-model.md)) — so a contest built in the
chat panel says what is outstanding while the host is still in the chat.
On success it calls `compile()`, persists the resulting immutable `Contest`
with a generated join code, and the draft is retired.

Spec: [`validate-and-publish-contest`](../../openspec/specs/validate-and-publish-contest).

## 3. Join — the participant enrolls

A participant enters the join code (or, more recently, **scans a QR-style
scannable code** the host displays —
`packages/host-web/src/contests/scannable-code.tsx`,
`packages/api/src/contests/join-link.ts`) in `packages/participant-web/src/pages/join.tsx`,
picks their display name, and becomes a **voter** scoped to that one contest —
a session distinct from the host's, carrying only that contest's id.

Spec: [`enroll-participants`](../../openspec/specs/enroll-participants).
Note: the join link is built from `PARTICIPANT_WEB_ORIGIN`
(see [operations/security-and-ops.md](../operations/security-and-ops.md)) — a
wrong value sends a scanned code somewhere that doesn't exist.

## 4. Submit a dish

Every voter under `solo`/`solo_with_partners` submits their own dish; under
`couples`, one dish per couple. `SubmitDish`
(`packages/api/src/dishes/use-cases/submit-dish.ts`) is scoped by the
`MaterializedContest`'s `allowedVoters` map, so who may submit what is a
lookup against the compiled rules, not re-derived logic.

Spec: [`submit-dishes`](../../openspec/specs/submit-dishes).

## 5. Score — taste and score

`packages/participant-web/src/pages/score.tsx` renders the score track, adapting
itself to the compiled `scoreRangeByVoter` and `uniquePerCategory` — so an
invalid score (out of range, or a duplicate under strict-permutation mode)
cannot be entered in the UI at all. `SaveScore`
(`packages/api/src/scoring/use-cases/save-score.ts`) additionally
double-checks each write against `checkScore` server-side. Scores are freely
editable while the voter's `VoteSession` is `draft`.

Spec: [`taste-and-score`](../../openspec/specs/taste-and-score).

## 6. Send — the vote locks

`SendVote` (`packages/api/src/scoring/use-cases/send-vote.ts`) transitions the
`VoteSession` from `draft` to `sent` — a **one-way lock**; there is no
edit-after-send in the built system, which is why the participant app shows a
pre-send confirmation sheet
(`packages/participant-web/src/confirm-sheet.tsx`) as the actual safety net.

## 7. Close and reveal — host-triggered or scheduled, then confirmed

A contest **closes** either when the host triggers it directly, when every
voter has sent their vote (`all_sent`), or at a scheduled time
(`shouldAutoClose`, `packages/domain/src/contest/close-check.ts`). Once closed,
it refuses further dishes/scores/sends. The host then **reveals** results — a
per-category winner and an overall winner, computed by summing sent votes only;
ties surface as joint winners rather than being resolved automatically (tie
resolution is unbuilt, see [`docs/backlog.md`](../../docs/backlog.md)).

Both **close** and **reveal** are **destructive actions** — see the
propose→confirm→act gate in
[architecture/overview.md](../architecture/overview.md#destructive-actions-propose--confirm--act).
This applies identically whether the host clicks a button in the control room
(`packages/host-web/src/pages/contest-control.tsx`), asks the in-app assistant,
or drives an external MCP client.

Spec: [`manage-live-contest`](../../openspec/specs/manage-live-contest),
[`reveal-results`](../../openspec/specs/reveal-results),
[`host-sees-the-results`](../../openspec/specs/host-sees-the-results),
[`see-the-results`](../../openspec/specs/see-the-results) (the participant's
equivalent, which also updates live without a reload once revealed).

## Doing this end to end, once

`docs/demo-script.md` is a runnable 15-minute script that drives this entire
journey (both creation paths, a destructive-action confirmation, the audit log)
and is worth reading before making changes to any step — it documents the exact
UI states and stub phrases used to make the flow demoable deterministically.

## What to watch out for when changing a lifecycle step

- Every step above is reachable from **all three entry points**
  ([architecture/overview.md](../architecture/overview.md)) — check the MCP
  tool catalog (`packages/mcp/src/tool-catalog.ts`) and the assistant's
  behavior, not just the HTTP route, when changing what a step accepts or
  refuses.
- Acceptance specs for each step are Gherkin `.feature` files under each
  package's `tests/acceptance/`, using **domain language only** — see
  [testing.md](../testing.md).
- Whole-system E2E specs under `tests/e2e/` (e.g.
  `host-create-contest.spec.ts`, `participant-score.spec.ts`,
  `host-sees-the-results.spec.ts`) exercise the real flow across both apps and
  the API together and are axe-gated for accessibility.
