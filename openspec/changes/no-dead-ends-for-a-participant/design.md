## Context

The participant app has four screens across three routes, and two of them are dead ends. Driving the running app and listing every link on the page:

```
   dish form (inside /  and /j/:code)   ["Skip to content", "Score the dishes →"]
   /score                               ["Skip to content"]              ← nothing
   /reveal  (waiting)                   ["Skip to content"]              ← nothing
   /score   revisited after voting      ["Skip to content"]              ← nothing,
                                        and the heading still reads "Score the dishes"
```

The dish form is not a route of its own: it is the `joined` step of `Join`, rendered at `/` or `/j/:code` once the device is recognised. So a participant's only way out of `/score` or `/reveal` is the browser's back button — the exact move that strands them.

The misleading part has a single cause. `GET /contests/:id/scores` answers `{ scores }` and nothing more (`voter-routes.ts:170`), so the app **cannot find out whether the vote has been sent**. `Score` therefore tracks it in React state (`state.kind === 'sent'`), set only by a successful send in that same page life. The "See the results" link lives inside that branch, so a reload or a step back wipes both the knowledge and the link. The screen falls back to rendering the ballot, and a participant who has already voted is shown a form they cannot use.

The API is not confused about any of this — `vote_sessions.status` is `draft | sent` and `SendVote` enforces the lock. The fact simply is not passed on.

## Goals / Non-Goals

**Goals:**

- No screen a joined participant can reach is a place they cannot leave.
- Whether a vote is sent is known from what is recorded, not from what a screen remembers.
- A sent vote reads as sent, shows what they gave, and offers nothing to change.
- Where a participant goes stays their choice.

**Non-Goals:**

- No change to what a vote is, when it may be sent, the completeness rules, or the confirmation before sending. A sent vote is still final.
- No editing or withdrawing a sent vote. Read-only means read-only.
- No new endpoint. The missing fact rides along with a read that already happens.
- No navigation for the host app. Its screens have their own way around, and nothing here reports a problem there.
- No route for the dish form. Giving it one is arguable but it is a bigger change than this defect warrants, and the `joined` step already lands there reliably.

## Decisions

### Free navigation with a read-only sent vote, not an automatic redirect

Once a vote is sent, the scoring screen shows it as sent and offers a clear way through to the results. The alternative — redirecting `/score` to `/reveal` for anyone who has voted — was considered and rejected on three grounds:

**It makes the back button unusable.** From the results, going back lands on `/score`, which would immediately send them to the results again. A participant could not leave the results screen at all — a worse version of the very defect being fixed here, and directly contrary to letting them move freely.

**It is an unannounced context change.** The page moves under them with no explanation, which is hardest on someone using a screen reader. This project hard-gates axe at WCAG 2.1 AA; an automatic redirect is the kind of thing that passes an automated scan and fails a person.

**It refuses a reasonable question.** Someone who steps back after voting usually wants to check what they gave. Showing them is the answer; bouncing them to a screen they just left is not.

What the redirect wins is one tap for a participant who only wants the results. A prominent link recovers most of that without taking control away.

### The sent status rides along with the scores

`GET /contests/:id/scores` answers `{ scores, status }`, where status is the vote session's own `draft | sent`. No new endpoint, no extra round trip: the screen already makes this call on load, and the answer it needs is one field away in a record it is already reading.

Rejected: a separate "has my vote been sent?" endpoint (a second request for one boolean, and a second thing to keep in step); and inferring it from a failed save (a guess dressed as a fact, and it needs the participant to try something first).

### Every screen offers what is currently reachable

Each of the three screens carries the steps open to a joined participant, rather than each screen knowing about one specific next screen. What is *open* varies — the results are worth offering once voting is under way; the dishes always are — so the set is derived from where the participant is, not hard-coded per screen.

This is the part that stops the class of problem rather than the two instances of it. A future screen that forgets a link is the same defect again.

### The dish form keeps its address

The dish form stays part of the join route rather than gaining a `/dish` of its own. Giving it one would make it linkable and reloadable, which is tempting, but it means untangling the `joined` step from `Join` and re-deciding what a deep link to a dish form does for someone who has not joined. That is a bigger change than this defect justifies. Links to the dishes point at the join route, which recognises the device and lands on the dish form.

## Risks / Trade-offs

- **The change looks smaller than it is.** The visible fix is a few links, but the load-bearing part is the API telling the truth about the vote. → Build the status first, with a test that reads it back after sending; the links are worth little on top of a screen that still cannot tell what happened.

- **Navigation is exactly what the tests do not cover.** Every existing scenario walks forward through the journey by following links. Nothing arrives by the back button, a reload, or a typed address — which is why this shipped. → The new whole-system coverage has to arrive those ways specifically, and in both browsers, since this is the mobile-first app.

- **A read-only ballot is easy to render as a broken one.** Disabled controls that look enabled, or a screen that says "sent" while still showing a send button, would be worse than today. → The requirement is that nothing offers to change or resend, asserted rather than eyeballed, and the sent state needs its own accessibility scan.

- **More links on a small screen.** The participant app is deliberately spare and mobile-first, one column at ≤460px. → Keep the ways onward compact and at the foot of the flow, and re-run the 320px reflow check, which is already automated.

- **A link to a step that is not open yet.** Offering "the results" before there is any vote to speak of, or "the dishes" after a contest has closed, would be noise. → Derive what is offered from where the participant actually is, and say plainly in the tests which steps are expected on each screen.

## Migration Plan

Additive. One response gains a field; the participant screens gain links and a sent rendering. No schema change, no migration, no change to any existing endpoint's contract beyond an added property, which older clients ignore.

Rollback is reverting the screens; the extra field is harmless on its own.

Order: the status field and its test first, then the sent rendering that depends on it, then the navigation, then the arrive-by-back-button coverage.

## Open Questions

- Whether the dishes should still be offered once a contest has closed and the dish list can no longer change. It is still information a participant may want, so probably yes, but it is worth deciding rather than defaulting.
- Whether the results should be offered from the scoring screen before the participant has sent anything. It leads to a waiting screen either way, so it may be reassuring or may be a distraction from finishing the vote.
- Whether the sent scoring screen should show the scores in the same layout as the editable one, or a plainer summary. The same layout is less work and more familiar; a summary is calmer and less likely to read as a form that is refusing input.
