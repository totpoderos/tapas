## Context

`RevealView` lives in `@tapas/ui` and takes its results as a prop; fetching, polling and routing stay with each app. Its own header records why: "so the two screens cannot drift apart in what they show". `host-sees-the-results` then promises that the host and a participant are told the same winners in the same order.

That promise currently costs nothing to keep, because there is one component. The existing coverage — the host's results spec and the participant's reveal spec — reads each screen and finds the same winner, but both screens resolve to the same code, so the assertion cannot fail for the reason it was written. It is a tautology dressed as a test.

A participant restyling is what turns that from a curiosity into a risk.

## Goals / Non-Goals

**Goals.** Decide how the reveal is shared once the two screens want to look different. Put a real test under the same-results promise. Write down what any restyle must not undo.

**Non-Goals.** Any new visual treatment for the participant reveal — that design does not exist yet, and inventing it here would be designing without a brief. Also out: changing what the host's results screen looks like, which already draws what the current design asks for.

## Decisions

### What a restyle may not undo

Four properties were paid for once and must not be re-paid. They are recorded here and beside the component, because each of them is invisible in a screenshot and easy to lose in a rewrite.

1. **Saffron is an accent, never text.** `--saffron` is 2.24:1 on the light ground — it fails as a text colour. It appears as the winner's underline and as a soft tint with `--ink` over it, and nowhere else.
2. **The entrance animation is neutralised under `prefers-reduced-motion`.** The accessibility scans depend on a stable final frame to measure contrast against; an animation that survives the media query makes those scans flaky as well as making somebody ill.
3. **Rank is carried by its number**, not by weight or tint alone, so a leaderboard read without the styling still says who came where.
4. **Both apps carry a `reveal` i18n resource, and the component asks for full key paths.** i18next answers a missing key by echoing the key, which in a label is read aloud. The English defaults in the component are the safety net, not the plan.

### How the reveal is shared, once the two want to differ

**Decided: C — two copies**, now that there is a design to decide against. The three that were on the table:

- **A — one component, a variant prop.** Cheapest, and right if only accents differ. Wrong the moment the two layouts differ structurally: variant props that accumulate become a component that draws neither screen well.
- **B — split the shape from the drawing.** The results shape (`RevealData`) and any ordering logic stay shared; each app draws its own.
- **C — two copies.** What the anti-drift rule exists to prevent. To be refused unless the two screens have genuinely become different products.

The "Vermouth glass" handoff makes them different products. The participant reveal leads with a 112px rank numeral, promotes the winning **dish** to the headline and names the cook in a sentence beneath it, drops the trophy, and sits on a palette and type family the host panel does not share — against a host reveal that already draws what its own design asks for and is not changing. A variant prop spanning those two is a component with two disjoint bodies.

Note that C as taken here is C-over-B: the *drawing* forks, the **shape does not**. `RevealData` stays in `@tapas/ui` as the one declaration of what a revealed contest is, and both apps keep taking it as a prop. What is duplicated is markup and styling, which is the part that is supposed to differ.

### What actually holds the promise up, under C

The existing API check — `a-host-sees-the-results.feature.spec.ts`, "The host and the participants see the same results" — compares `/contests/:id/winners` against `/contests/:id/reveal`. It is worth keeping, but it is worth being exact about what it proves. Both routes call the same `toRevealDto`, so it is not testing that two independent computations agree; it is testing that the two routes hand that one builder equivalent arguments. That is a real property (a route could stop resolving dish names the same way) and a narrow one.

What no test in the suite currently sees is the **rendering**. While one component drew both screens, that gap cost nothing. C is precisely the change that opens it: a participant reveal that sorted its leaderboard differently, showed only the top three, or labelled a dish by its cook would contradict `host-sees-the-results` and pass every check that exists.

So the test this change owes is across the two rendered screens, and it is load-bearing rather than belt-and-braces.

*Alternative considered:* rely on the API check alone. Rejected — it is blind to the layer C is about to fork.

*Superseded:* an earlier draft of this change put the new assertion on the two API reads, on the grounds that the screens resolved to one component and so could not fail. That reasoning was right about the screens and wrong about where the tautology lived — it is at `toRevealDto`, one layer below the routes, so moving the assertion onto the routes relocates the problem rather than removing it.

## Risks / Trade-offs

- ~~**This is groundwork for a design that does not exist.**~~ Resolved: the design arrived mid-change, and it is structural. The insurance is being claimed, not written off.
- **A test against two reads can pass while both are wrong together.** It protects agreement, not correctness; correctness is `reveal-results`' business and is covered there. This holds for the rendered-screen check too.
- **Two copies drift silently by nature.** The rendered-screen check catches the properties `host-sees-the-results` names — winners, order, dish names — and nothing else. Spacing, wording around the result, and what surrounds it are free to diverge, which is the point; but so is anything the requirement forgot to name. The four properties recorded above are the counterweight, which is why they sit beside the component and not in a commit message.
