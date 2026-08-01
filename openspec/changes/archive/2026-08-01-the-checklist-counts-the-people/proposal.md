## Why

The publish checklist exists so a host is never left pressing publish and reading a refusal to find out what was missing. It checks the name, the scoring categories, the score range and who still wants a partner — and says nothing at all about whether anybody is taking part. So a contest with an empty roster reads **"Everything needed is in place."**, and publishing it is refused by the API.

That was always wrong and is now routine. Since `the-rules-and-the-people-part-ways`, the form that starts a contest no longer asks who is taking part: it saves and hands over to the participants section, where a host arrives at an empty roster beside a checklist claiming the contest is ready. The very first thing a new contest shows its host is a green tick that is not true.

Two participant rules in the compiler are certain, not situational, and both can be predicted exactly:

- **Nobody at all** is refused outright (`NO_PARTICIPANTS`, "A contest needs at least one participant").
- **Exactly one person** is always refused too, though less obviously: they get one dish, nobody may score their own dish, so the only judge can score nothing and `JUDGE_CANNOT_SCORE_ANY_DISH` follows. There is no draft of one person that publishes.

## What Changes

- The publish checklist gains a **people** item. It is not ready when nobody is taking part, not ready when only one person is, and ready with a count once there are at least two.
- The one-person case says *why* two are needed rather than only that they are — nobody may score their own dish, which is not something a host should have to deduce from a refusal.
- Nothing else about the checklist changes: it stays a prediction on the client, publishing still asks the API, and the API's answer still governs.

Not included, deliberately:

- **Predicting `JUDGE_CANNOT_SCORE_ANY_DISH` in general.** Whether every judge can score something depends on attribution, the anti-bias rule, the pairings and the barred pairs together — the compiler's job. A contest of one couple and nobody else still passes this checklist and is still refused by the server, and that is the documented shape of the thing: the checklist predicts, the server decides. Only the two rules that are certain from a count alone are predicted here.
- Any change to what the API checks, to `compile()`, or to what a draft is.

## Capabilities

### Modified Capabilities

- `prepare-a-contest`: what the publish checklist says is still missing now includes whether enough people are taking part.

## Impact

- `packages/host-web/src/pages/draft/draft-workspace.tsx` — the checklist gains one derived item.
- `packages/host-web/src/i18n/locales/{en,es}/review-draft.json` — three strings, in both languages.
- `packages/host-web/tests/unit/draft-sections.test.tsx` and `tests/e2e/host-draft-review.spec.ts` — the three states.
- No change to `packages/api`, `packages/domain`, `packages/mcp` or `packages/participant-web`.
