## Context

`packages/participant-web` is four pages (`join`, `your-dish`, `score`, `reveal`), one 356-line stylesheet, and a handful of `@tapas/ui` components. It imports `@tapas/ui/tokens.css` and draws on the "Service" palette — Berenjena `#6a2757`, Azafrán `#e39b12` — in two themes, with a toggle. So does the host panel, which is 83/85 tasks into `the-panel-gets-a-modern-shell`, a change whose own proposal says the panel is drawn "entirely on the tokens already in `packages/ui/src/tokens.css`, in both themes, so the panel becomes a workspace **without becoming a new visual language**."

The "Vermouth glass" handoff asks for a new visual language in the other app: vermouth `#8c2f39`, amber `#8a5a09`, a warm `#f6f2ec` sheet under a radial wash, glass surfaces at `rgba(255,253,249,.64)` with `backdrop-filter: blur(14px)`, Source Serif 4 throughout, 999px pills, accent-tinted shadows, and light values only.

Both apps currently draw the reveal with the same component. `the-reveal-is-ready-to-be-restyled` forks that into two copies and puts a rendered-screen test under the same-results promise; it lands first, and this change restyles the copy it leaves in `participant-web`.

## Goals / Non-Goals

**Goals.** Draw the fourteen screens of the handoff. Make the two apps' divergence a stated decision with a boundary, not a drift. Replace the fifty-target scoring page with a control a person can use one-handed. Give the seven undrawn states a screen. Keep the accessibility floor this repo hard-gates on.

**Non-Goals.** The host panel — untouched, tokens and themes intact. Strict-ranking mode — no design exists, and inventing a ranking control here would date the moment a brief arrives. A dark participant theme. Any change to the tally, the constraint view, or how a vote is validated: this changes what a participant is shown and how they enter a score, never what a score means.

## Decisions

### The two apps share types, not styling

`packages/participant-web` stops importing `@tapas/ui/tokens.css` and owns a complete token sheet of its own. It keeps importing `RevealData` — a type, no CSS — and nothing else that carries a look.

*Alternatives considered.* **Rebind the roles**: keep `@tapas/ui` components and override `--brand`, `--ground`, `--serif` at the participant root. Cheapest, and the strict-ranking branch would re-tint for free. Rejected because the handoff's geometry is not expressible as token values — `Button`'s radius lives in `button.module.css`, and a 999px pill with a 54px floor and an accent-tinted shadow can only be reached by reaching into another package's module CSS from outside it. That is a tighter coupling than the one being undone. **A `variant` prop on the shared components**: rejected for the same reason `the-reveal-is-ready-to-be-restyled` rejected it for `RevealView` — variant props spanning two disjoint designs produce a component that draws neither well.

So `Button`, `FormField` and `LanguageSelect` get participant-local replacements. This is duplication, chosen knowingly: the shared versions stay exactly as the host panel needs them, and neither app can now break the other's chrome. The boundary to hold is that participant-shaped components **never** travel back into `@tapas/ui`.

### Light only, pinned rather than merely unstyled

`ThemeToggle` leaves `main.tsx`, `initTheme()` goes with it, and the document is pinned to the light theme. Pinning matters: `tokens.css` today flips under `prefers-color-scheme: dark` unless `data-theme="light"` is set, so an unpinned app on a dark phone would take a dark ramp it has no values for.

Nothing asserts otherwise — `theme-toggle.spec.ts` drives the host app's sign-in screen, and no spec under `openspec/specs/` mentions themes at all. So this costs no test, but it removes a control participants can use today, which is why the proposal marks it **BREAKING** rather than letting it pass as tidying.

*Alternative considered:* derive dark values ourselves. Rejected — glass over cream does not invert mechanically, and choosing the dark palette is designing without a brief.

### The score track is a radio group wearing a slider

The control saves a discrete integer in `[range.min, range.max]`; it is not a range input and must not become one. Underneath stays `role="radiogroup"` with one input per step, so arrow keys, Home/End, and the checked label's announcement all keep working. Pointer and touch are layered on top: down anywhere on the track selects the nearest step, dragging updates a **transient local value** that snaps, and release commits through the existing optimistic `save()` with its rollback.

Two fallbacks the handoff names and this design keeps:

- Above roughly twelve steps, the per-step labels are dropped and only min and max are drawn. The label count follows `ballot.range`, which is host-configurable and has no upper bound worth trusting.
- Below 360px the labels drop to min/max regardless. Ten labels across a 320px column is the specific thing the existing reflow test will catch.

The steps are ~35px wide — under the 44px this repo holds itself to. They are 64px tall, drag-correctable, and each is also reachable by keyboard, which is the argument for accepting it; it is also the one place an axe pass will not decide the question for us, so it needs a manual check rather than a green tick.

### One dish at a time lives in the URL

Pagination goes in the route (`/score/:index` or equivalent), not in component state.

The reason is not tidiness. Screen 8's "Taste missing →" must jump to a specific dish and focus a specific category, and the back button on screen 7 must go to the previous dish rather than out of the app. Both are free with a route param and both need inventing without one. A participant who reloads mid-ballot lands where they were.

### Two disclosures, decided rather than absorbed

Both are widenings of what a participant may learn about other participants. Neither is large; both are the kind of thing that becomes a finding when it arrives as an unremarked API field.

**The roster of taken places.** Today a join-code lookup returns only unclaimed places; after this, it returns the whole roster with each place marked taken or open. Someone holding a join code therefore learns who has already turned up. Accepted: join codes are high-entropy and expire when the contest closes, the names are the ones the host typed and are visible to everyone in the room anyway, and no contact information is attached. What it buys is screens 3 and 4 — a contest with every place taken can explain itself instead of printing one muted line.

**Who has still to vote.** The waiting screen names participants whose vote is not in. Accepted, with two limits written into the spec rather than left to the implementation:

1. The read is **contest-scoped and participant-authenticated** — the same token that already gates the ballot. It is not public to a join code.
2. It reports **sent or not sent, and nothing else**. Not how many dishes someone has scored, not which, not any value. Partial progress is a behavioural detail about a person in the room; whether their vote is in is a fact the reveal is waiting on.

The screen already polls every 2000ms, so this read inherits that cadence and should be counted when rate limits are reviewed.

*Alternative considered:* the handoff's own fallback, "Waiting for the host", which discloses nothing. Rejected on the user's decision — but it stays the correct degraded answer if the read is unavailable.

### The cook joins the reveal payload

`RevealWinner` is `{ dishId, name }` where `name` is the dish. Screen 12's headline sentence — "Iván takes Tapas de Junio with 47 points" — needs the cook, and nothing in `RevealDto` carries one. The total is already available from `standings`.

`toRevealDto` is shared by both routes, so the field appears in the host's payload too. That is acceptable and it is not a host redesign: the host simply does not draw it. The requirement that a dish is identified to both audiences by the name it was submitted under is unaffected — the cook is added beside the dish name, never in place of it.

### Strict ranking is left where it is

`RankingInputs` keeps its select-per-dish control. Under the decision above it does not inherit a re-tint for free — participant-web owns its tokens, so the branch has to be re-dressed to the new sheet even though its interaction does not change. That work is in scope; designing a new ranking control is not. A contest configured with `uniquePerCategory: true` will look like the rest of the app and behave as it does today.

### Sub-slicing

Each slice is one ATDD loop and one PR, ordered so the decisions that could be wrong are tested earliest and cheapest.

```
  0 · the-reveal-is-ready-to-be-restyled   ← prior change, lands first
  A · the surface        tokens, nav, ways onward, screens 13–14, light-only
  B · join               screens 1–4       ▸ roster disclosure
  C · your dish          screens 5–6
  D · scoring            screens 7–8       ▸ track + pagination + review (largest)
  E · sending            screens 9–10      ▸ bottom sheet, totals per dish
  F · waiting            screen 11         ▸ new read + disclosure
  G · reveal             screen 12         ▸ restyle the forked copy, + cook
```

Slice A is deliberately the two flattest screens — 13 and 14 carry no glass, no accent and one button each. If the local-components decision is wrong, A is where it is cheap to find out.

## Risks / Trade-offs

- **Duplicated components drift.** `Button` and `FormField` now exist twice, and a fix to one will not reach the other. → The boundary is stated here and the two are allowed to differ; what may not differ is the reveal's winners, order and dish names, which the prior change puts a rendered-screen test under. Nothing else in the two apps is promised to agree.
- **The score track is the accessibility risk of this change.** ~35px steps, a drag gesture, and a value announced from a control that looks like a slider and is not. → Keyboard operation is the primary path and is tested; pointer is an addition. A manual screen-reader and keyboard pass is owed on slice D specifically, not deferred to the end.
- **Turnout is visible before the reveal.** A participant can see that four of five are in. → Bounded to sent/not-sent, contest-scoped, participant-authenticated. It reveals nothing about scores, and the reveal itself stays host-triggered.
- **Two of the fourteen screens are not a restyle.** Pagination and the ballot review are new behaviour inside `taste-and-score`. → They are specified as requirement changes rather than carried as styling, and slice D is expected to be the largest piece of work in the change.
- **`@phosphor-icons/react` is a new runtime dependency** in an app used on old phones at a venue. → Import per-icon rather than the barrel, and check the built bundle size on slice A before the rest of the icons arrive.
- **The MCP surface may mirror the widened reads.** This repo's recurring bug is two equivalent paths diverging in one layer. → Each widened read is checked for an MCP mirror as part of its own slice, not swept up at the end.
