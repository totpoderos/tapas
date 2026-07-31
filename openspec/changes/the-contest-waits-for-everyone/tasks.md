# Tasks

One fix, one PR. The acceptance scenarios come first and are confirmed before
any implementation, as every change in this repo is.

- [x] 1.1 Write the failing coverage first, at both levels: `shouldAutoClose` in the domain, and the send-vote path in the API, where the contest must stay live while a place is unclaimed.
- [x] 1.2 Rename the fact from `allClaimedSent` to `allPlacesSent` and change what it means. The rename is the point — a boolean whose name still said "claimed" would go on being computed from the claimed set by the next person to touch it.
- [x] 1.3 Compute it in `SendVote` from the whole roster rather than from `listClaimed`.
- [x] 1.4 Update the scenarios that pinned the old rule, and add the one nobody had asked: everyone who claimed has sent, but a place is still open.
- [x] 1.5 An end-to-end check that a participant who joins after somebody else has already voted can still score and send.
- [x] 1.6 Run the verification. Typecheck clean, lint clean, vitest 2004/2004, Playwright 304/304 (Chromium + WebKit), `openspec validate` passing, and the journey driven live against a real stack: one participant votes and the contest stays **live** where it used to close; a latecomer then claims, submits a dish, scores and sends; and the contest closes on its own only once the last place has sent.
