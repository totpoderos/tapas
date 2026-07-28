## Why

The host can end a contest but never see how it ended. They close voting, trigger the reveal, and the winner appears on sixteen guests' phones — not on theirs. To find out who won, the host has to borrow someone's screen.

This is the last gap in the contest's story: every other moment a host runs (create, publish, watch the tally, close, reveal, read the audit log) has a screen, and the one everybody actually came for does not.

## What Changes

- **The host gets a results screen.** Reached from the control room once a contest is revealed, showing the same thing everyone else sees: the overall winner or joint winners, each category's winner, and the leaderboard of every dish — all by name.
- **A new host-scoped way to read a revealed contest's results by name**, alongside the participant one. It answers only for the host who owns the contest, and — like the participant's — refuses until the contest has actually been revealed.
- **The reveal view becomes shared** between the two apps rather than living only in the participant app, so the two screens cannot drift apart. This is the long-open task 5A.2 of the `tapas-contest-app` change.
- No change to what a participant sees, to how a reveal is triggered, or to the existing raw results reading used by the assistant.

## Capabilities

### New Capabilities

- `host-sees-the-results`: a host reads their own revealed contest's results — winners and leaderboard by name — refused until the contest is revealed and refused to anyone who does not own it.

### Modified Capabilities

None. `see-the-results` (a participant reading results) and `reveal-results` (a host triggering the reveal) are unchanged; this adds a distinct actor's view rather than altering either.

## Impact

- **API** — one new host-scoped read. The existing participant read and the existing raw host read (`ResultsDto`, still serving the assistant's `get_results`) both stay exactly as they are.
- **`@tapas/ui`** — gains the reveal view, moved out of the participant app. Both apps then render it. The move must preserve two accessibility properties that were paid for once already (saffron used as an accent rather than as text, and the entrance animation's interaction with contrast checking) and must supply its translation keys in both apps.
- **Host app** — a new screen and a way into it from the control room.
- **Participant app** — renders the shared view instead of its own copy; no behaviour change.
- **Not included** — the assistant still answers "who won?" with dish identifiers rather than names. Real, and a separate change.
