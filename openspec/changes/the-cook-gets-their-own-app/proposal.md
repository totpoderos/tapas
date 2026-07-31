## Why

The participant app and the host panel have been one visual language because they were built from one token sheet, not because anyone decided they should match. They are not used alike: a host sits at a laptop and administers, while a cook stands in a room holding a plate, one-handed, in bad light, on whatever phone they own. The design handoff *Participant app — "Vermouth glass"* draws the second of those as its own product across all fourteen screens of the journey, including the seven states the app currently has no drawing for.

It also fixes two things that are not decoration. Scoring today lays every dish and every category on one page as rows of ten radio buttons, so a five-dish contest is fifty targets on a phone and no way to see what you have already done. And the states a participant actually hits when something goes wrong — an unknown code, a contest with every place taken, a lost session, a deleted contest — are a muted line of text or a red banner at the top of a page whose content no longer applies.

## What Changes

- **The participant app becomes its own visual language.** Vermouth `#8c2f39` over a warm sheet, glass panels, Source Serif 4, pill geometry, accent-tinted shadows. The host panel keeps the "Service" tokens and is not touched. `@tapas/ui` keeps only what the host still uses; the participant app's chrome lives in `packages/participant-web`.
- **BREAKING — the participant app is light only.** `ThemeToggle` leaves `packages/participant-web` and the app pins itself to the light theme. The handoff has no dark values, and glass over cream does not invert mechanically. The host panel keeps both themes and its toggle.
- **Scoring becomes one dish at a time.** A progress rail, a dish per screen, and a **score track** — a single 64px-tall control per category replacing twenty small radios. It stays a radio group underneath (`role="radiogroup"`, one input per step, arrow keys, Home/End) with pointer-drag layered on that snaps to the nearest step; the value that saves is always a discrete integer in range.
- **A ballot review before sending.** Because a paginated ballot hides what you have already done, a review screen lists every dish with its scores and, when the ballot is short, names the dish and category still missing and links straight to it. The send confirmation becomes a focus-trapped bottom sheet in thumb reach.
- **Waiting names names.** While the host has not revealed, a participant is told how many votes are in and which participants have still to vote, updating on the poll that already runs. This discloses one participant's progress to the others and is a deliberate decision, not a by-product — see design.md.
- **Joining shows the whole roster.** The places list keeps taken places, dimmed and tagged, instead of dropping them, and an entirely-taken contest gets a screen that explains and offers a way out rather than one muted sentence. Anyone holding a join code therefore learns who has already joined.
- **The reveal names the cook.** "Iván takes Tapas de Junio with 47 points" — the winning dish is the headline and the cook is named beneath it. Nothing in the reveal payload carries a cook today.
- **Every error moves to the thing that failed.** Inline on the field, the row, the panel — never only a banner above a title that no longer applies.
- Not included, deliberately: **strict-ranking mode**. `RankingInputs` (`uniquePerCategory: true`) has no design and keeps its current control. It inherits the new palette through the token layer and nothing else. Designing a ranking control without a brief would date the moment one arrives.

**Depends on `the-reveal-is-ready-to-be-restyled`**, which forks the reveal into two copies and puts a rendered-screen test under the same-results promise before any styling diverges. That change must land first; this one restyles the participant copy it creates.

## Capabilities

### New Capabilities

- `participant-app-shell`: the chrome and surface rules every participant screen holds — a visual language of its own, distinct from the host panel and stated as such; light theme only; the header bar and the ways onward present on every joined screen; errors attached to what failed rather than to the top of the page; and the accessibility floor (touch targets, reflow at 320px, motion neutralised under `prefers-reduced-motion`) that no screen may trade away.

### Modified Capabilities

- `enroll-participants`: looking up a contest by its join code returns the whole roster — the places still open **and** the places already taken, named and marked as taken — instead of only the open ones.
- `taste-and-score`: a participant scores one dish at a time and can review the whole ballot before sending; an incomplete ballot names which dish and category are still missing rather than only refusing to send.
- `see-the-results`: while waiting for the reveal a participant is told how many votes are in and who has still to vote; a revealed result names the cook behind the winning dish, not only the dish.

## Impact

- `packages/participant-web` — every screen recomposed; its own token layer and CSS Modules; the score track, the bottom sheet, the ballot review and the reveal copy as local components; `ThemeToggle` removed and the theme pinned; EN and ES resources for every new string.
- `packages/ui` — no new participant-shaped components. `RevealData` stays shared as the shape both apps agree on; `RevealView` is the host's after the prior change. `Button` and `FormField` are re-evaluated: whichever the participant app can no longer wear is replaced locally rather than given a variant.
- `packages/api` — the join-code lookup widened to the whole roster; a read for votes in, votes expected, and who is outstanding; the reveal DTO given the cook.
- `packages/domain` — no rule changes expected; the tally and the constraint view are untouched.
- `packages/mcp` — check each widened read for a mirror. The MCP surface is a thin adapter, and this repo's recurring bug is two equivalent paths diverging in one layer.
- `tests/e2e` — a `.feature` per sub-slice; axe-core keeps hard-gating; the 320px reflow test is the one the score track's ten step labels must survive.
- One new dependency, `@phosphor-icons/react`, pinned with the lockfile committed.
- Security review owed on two disclosures: the roster of taken places, and per-participant voting progress before the reveal.
