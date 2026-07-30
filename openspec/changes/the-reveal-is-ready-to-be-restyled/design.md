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

Not decided here — deliberately, because the participant design does not exist and the right answer depends on how far it diverges. What is decided is that the choice is made explicitly, from these three:

- **A — one component, a variant prop.** Cheapest, and right if only accents differ. Wrong the moment the two layouts differ structurally: variant props that accumulate become a component that draws neither screen well.
- **B — split the shape from the drawing.** The results shape (`RevealData`) and any ordering logic stay shared; each app draws its own. Costs a little duplication in markup, keeps the thing that actually has to agree in one place. The likely answer if the redesign is a real redesign.
- **C — two copies.** What the anti-drift rule exists to prevent. It should be refused unless the two screens have genuinely become different products, and if it is ever taken, the test below is the only thing left holding the promise.

Whichever is chosen, the promise must not be resting on it. Hence:

### The same-results test rests on the results, not on the renderer

The check compares what the host's API answers with what the participant's API answers for the same revealed contest: the winners, their order, and the names. It passes today, keeps passing under A and B, and is the only thing that would catch C going wrong.

*Alternative considered:* keep asserting through the two screens. Rejected — that is the tautology described above, and it would go on passing through a divergence that had already happened.

## Risks / Trade-offs

- **This is groundwork for a design that does not exist.** If the participant redesign turns out to change nothing structural, option A is taken and most of this was insurance. That is an acceptable price for not discovering the coupling halfway through a redesign — but it is why the change deliberately writes no CSS.
- **A test against two API reads can pass while both are wrong together.** It protects agreement, not correctness; correctness is `reveal-results`' business and is covered there.
