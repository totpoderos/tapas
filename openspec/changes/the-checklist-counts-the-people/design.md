## Context

`PublishChecklist` in `packages/host-web/src/pages/draft/draft-workspace.tsx` derives four items from the draft in front of the host: the name, the scoring categories, the score range, and how many participants still want a partner. It reports ready when every item is ready. It has never looked at whether anybody is taking part.

`compile()` refuses two participant counts outright:

- `people.length === 0` → `NO_PARTICIPANTS` (`packages/domain/src/compile.ts:39`).
- One person → one dish, and `submitters.has(p.id)` excludes them from scoring it (`compile.ts:91`), so their scoreable count is zero and `JUDGE_CANNOT_SCORE_ANY_DISH` follows (`compile.ts:106`). This holds for either attribution and every anti-bias rule: there is no draft of one person that publishes.

`the-rules-and-the-people-part-ways` turned this from a corner into the common path. The form that starts a contest no longer asks for participants; **Next** saves and lands the host on an empty roster, beside a checklist reading "Everything needed is in place."

## Goals / Non-Goals

**Goals:**

- The checklist is not green when publishing is certain to be refused for want of people.
- The one-person case explains itself, since "two are needed" is not self-evident.
- The count is shown once it is satisfied, like the categories item.

**Non-Goals:**

- **Predicting `JUDGE_CANNOT_SCORE_ANY_DISH` in general.** One couple and nobody else still passes this checklist and is still refused. Deciding that needs attribution, anti-bias, pairings and barred pairs together — which is `compile()`, and reimplementing it in the browser is exactly what "the checklist predicts, the server decides" exists to avoid. `tests/e2e/host-draft-review.spec.ts` already pins that case as intended.
- Blocking the Publish button. The checklist has never gated it, and the server's answer is still the one that governs.
- Any change to `compile()`, to the API, or to what a draft is.

## Decisions

### Three states from one count, because two of them are certain

The item reads the participant count alone:

| Count | Ready | Says |
|---|---|---|
| 0 | no | nobody is taking part yet |
| 1 | no | at least two are needed, because nobody may score their own dish |
| ≥2 | yes | how many are taking part |

Both not-ready states are *certain* — no draft with 0 or 1 participants can be published, whatever else it says. That is what makes them safe to predict. Everything beyond them is situational and stays with the server.

*Alternative considered:* one message for both ("at least two people are needed"). Rejected — at zero it reads as a rebuke for not having started, and at one it hides the reason. The reason is the interesting part: a host who has added one name and sees "two are needed" will otherwise wonder whether the contest is for pairs.

*Alternative considered:* counting only participants with a name typed in, as the categories item does (`filter(Boolean)`). Rejected — a nameless participant row is still a person the roster will carry, `buildContent()` sends them, and `compile()` counts them. Filtering here would make the checklist disagree with what publishing actually sees.

### It goes above the partner item

The items are read top to bottom as a list of what a contest needs. Having people at all comes before whether those people are paired, and a contest with nobody in it should not be told about pairing first. The partner item is also conditional on there being unpartnered people, so at zero participants it is absent anyway.

## Risks / Trade-offs

- **A host may read the green checklist as a promise that publishing will work** → it never was, the server still decides, and the two cases added here are the certain ones. The remaining gap (one couple, nobody else) is named in Non-Goals and already covered by a browser test that asserts the refusal is surfaced.
- **A count that disagrees with the server** → it reads the same list `buildContent()` sends, unfiltered, so the two cannot drift.
- **Three new strings in two languages** → the existing key audit over every `t()` call covers them, and the shell's raw-key guard would catch a missing one.
