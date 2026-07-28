## Why

A participant can get stuck. Once they are on the scoring screen there is nothing on the page that takes them anywhere — not back to the dishes, not on to the results. The same is true of the results screen while it waits for the host to reveal. Their only way out is the browser's back button, which is precisely the move that strands them.

And it strands them in a way that misleads. Coming back to the scoring screen after voting shows the ballot again under "Score the dishes", exactly as if the vote had never been sent, with no way through to the results. The "See the results" link exists only for the moment immediately after sending: it lives in the screen's memory, and a reload or a step back wipes it.

Underneath both is one gap. **The app cannot find out whether a vote has been sent.** Reading a participant's scores returns the scores and nothing else, so the screen has no way to know the vote is already in and falls back to a memory that does not survive leaving the page. A participant at a party, on a phone, moving between screens to check what they wrote, hits this immediately.

## What Changes

- **No screen is a dead end.** Every screen a joined participant can be on offers the other steps they can currently reach, so however they arrived — a link, the back button, a reload, a bookmarked address — there is always a way onward.
- **The app can tell whether a vote has been sent.** Reading a participant's own scores says whether they are still a draft or already sent. This is the missing fact behind the broken link, and it makes the answer survive a reload rather than living in a screen's memory.
- **A sent vote reads as sent, and cannot be changed.** Returning to the scoring screen after voting shows what they gave, plainly marked as sent, with no way to alter or resend it — and a clear way through to the results. Today it re-offers the ballot as though nothing had happened.
- **They keep control of where they go.** A participant who deliberately steps back to check what they scored is shown it, not bounced onward. Sending them to the results automatically was considered and rejected: it makes the back button unusable, because leaving the results would immediately return them to the results.
- No change to what a vote is, when it can be sent, or the confirmation before sending it. A sent vote is still final.

## Capabilities

### New Capabilities

None. This is a usability defect in journeys that already exist.

### Modified Capabilities

- `taste-and-score`: gains requirements that were left implicit — a participant can tell that their vote is already in and cannot change it, and can always move on from the scoring screen. The existing requirements about how scoring and sending work are unchanged and still hold.
- `see-the-results`: gains a requirement that the results screen, including while it waits for the reveal, is never a place a participant cannot leave.

## Impact

- **API** — reading a participant's own scores also reports whether the vote is a draft or sent. The vote session already records this; it is simply not passed on. No new endpoint, no schema change.
- **Participant app** — the three screens a joined participant uses gain a consistent way to reach the steps open to them, and the scoring screen learns to render a sent vote as sent rather than as an editable ballot.
- **Whole-system tests** — the journeys that matter here are exactly the ones nobody tests: arriving at a screen by the back button, by a reload, or by typing the address. Those need covering in both browsers, since this is the mobile-first app.
- **Not the security posture, and not the rules** — nothing here changes who may score, when, or what a sent vote means. The read-only rendering is a truthful view of a lock the API already enforces.
