# The contest waits for everyone

## Why

A contest set to close once everyone has voted closes **the moment the first
participant sends their vote**.

The rule is written against the people who have *claimed a place so far*, and
early in an evening that is one person. Whoever finishes first satisfies "every
participant who claimed a place has sent", the contest closes, and everyone else
is locked out: a closed contest refuses scores and refuses dishes. Their drafts
are stranded and there is no way back, because closing is one-way by design.

`all_sent` is the **default** close rule, so this reaches every contest published
without an explicit one. It was found in manual testing, not by the suite — the
existing "does not close early" scenario only covers a participant who has
already claimed, so the case where somebody has not arrived yet was never asked
about.

## What changes

- **BREAKING (behaviour):** `all_sent` closes only when **every place on the
  roster** has sent, not when every claimed place has. A participant who has not
  claimed a place now *does* hold the contest open.
- The host closes by hand when somebody never turns up. They are in the room and
  can see who came; the system cannot tell "not here yet" from "not coming", and
  guessing wrong ends the evening for everybody else.

## Impact

- `manage-live-contest` — the requirement is modified, and its second sentence
  ("a participant who never claimed a place SHALL NOT block this") is withdrawn.
- `shouldAutoClose` and its fact change shape: `allClaimedSent` → `allPlacesSent`.
- No migration. A contest already closed in error stays closed — reopening is a
  capability this repo does not have and is not being given here.
