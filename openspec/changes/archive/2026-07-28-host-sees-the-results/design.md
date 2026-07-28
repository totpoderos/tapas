## Context

A revealed contest already produces a display-ready view of its results — winners and a leaderboard, joined to dish and category names, sorted highest first. It is built by `toRevealDto` (`packages/api/src/contests/reveal-dto.ts`) and read by participants through a voter-scoped route, which withholds it (409 `NOT_REVEALED`) until the host reveals and which the participant app polls on.

There is also a *host*-scoped reading of results, returning the raw `ResultsDto`: dish ids and totals, **no names**. Its only consumer is the assistant's `get_results` tool — the host web app never calls it. So the host's own reading of results is the one that cannot be shown to a person without more work, which is why no host screen was ever built.

The participant reveal screen (`packages/participant-web/src/pages/reveal.tsx`) is the only implementation of the view. Task **5A.2** of the `tapas-contest-app` change asked for it to be shared between both apps; it never was.

The host's role at the reveal was the open question, and it is settled: **the host is a spectator**, watching along with everyone else — not an announcer working from a table of totals. That is what makes one shared view correct rather than two divergent ones.

## Goals / Non-Goals

**Goals:**

- A host can see who won their own contest, in the same terms everyone else sees it.
- The two apps render *one* view, so they cannot drift apart.
- The host's reading is gated exactly as the participant's is: nothing before the reveal.

**Non-Goals:**

- No analytical or "results table" view for the host. Rejected on the evidence above: the host watches, they do not announce from data.
- No pre-reveal peek. The host reveals blind, then watches with everyone.
- No change to what participants see, or to how a reveal is triggered.
- `ResultsDto` is **not** removed and `get_results` is **not** re-shaped here. The assistant answering "who won?" with dish ids is a real problem and a separate change.

## Decisions

### A separate host-scoped route, not a widened participant one

The host reads results through its own host-scoped route, reusing `toRevealDto` for the body. The obvious alternative — letting a host through the existing `/contests/:contestId/reveal` — was considered and rejected.

That route today has one authentication mechanism, one authorization rule, and one source for the contest id: **the voter's token**, not the URL. A voter therefore cannot read another contest's results whatever they put in the path. Admitting hosts breaks all three at once:

```
   widened /reveal                        separate routes
   ─────────────────────────────          ─────────────────────────
   voter cookie  OR  host cookie          voter cookie │ host cookie
   id from token OR  id from param        id from token│ id from param
   token scope   OR  ownership            token scope  │ ownership
            one handler                        one rule each
```

One destination reached two ways, where a check can hold on one path and not the other, is the precise shape behind three defects already recorded in this project (`docs/threat-model.md` §4): MCP vs assistant diverging on input validation, form vs assistant on participant id assignment, and test fixture vs real app on translation resources. Each shipped with a green test suite. Paying one small route to keep every path single-purpose is the cheaper side of that trade.

The host route takes the contest id from the path and authorizes by **ownership**, consistent with every other host contest operation.

### The view moves to `@tapas/ui`, participant-first

The existing participant screen is the reference implementation — it is real, it is axe-clean, and it already handles waiting, joint winners, and leaderboard ordering. It moves to `@tapas/ui` and the participant app renders the shared component; the host app then renders the same one. Rebuilding it for the host and leaving two copies is exactly the drift this change exists to prevent.

### Gating stays where it is

Both readings refuse until the contest is revealed. The participant app polls on that refusal, which is how the reveal lands without a page reload. Nothing about that changes; the host's reading simply answers the same way.

## Risks / Trade-offs

- **Extracting a working, accessible screen can quietly lose its accessibility.** → Two properties were paid for once already and must survive: saffron (`#e39b12`) **fails contrast as text** on the light ground (2.24:1), so it stays an *accent* — winner underline, soft tint — with dark `--ink` text; and the entrance animation trips axe's contrast check on a mid-fade frame, so the accessibility test emulates `prefers-reduced-motion: reduce` for a stable final frame. Keep the existing participant reveal tests green through the move, and add the same axe coverage to the host screen.

- **A shared component that asks for translations the host app has not got.** → A component in `@tapas/ui` resolves keys against whichever app renders it, and i18next answers a missing key by echoing the key itself — which, in an `aria-label`, is announced to a screen reader. This has already happened once here (`LanguageSelect` reading out "language.label"). Use full key paths, give `t()` an English default, and assert the rendered strings against the **real** app resources rather than a convenient fixture.

- **Two routes serving the same body can drift.** → They share `toRevealDto`, so the shape is defined once; the spec's "host and participant see the same results" requirement exists to keep that honest.

- **A host with no participants or dishes.** → The view already handles an empty leaderboard for participants; the host path must not assume otherwise.

## Migration Plan

Additive. A new route and a component move; no data migration, no change to existing endpoints or stored state. The participant app switches to the shared component in the same change, so there is never a period with two copies. Rollback is removing the host route and screen; the participant experience is unaffected either way.

## Open Questions

- Where the host enters the results screen from: the control room already shows "the results are out" once revealed, which is the natural place, but whether that becomes a link or a panel is a UI decision left to implementation.
- Whether the host screen should poll like the participant's does. The host is the one who triggered the reveal, so they arrive after it has happened and may not need to wait — but a host who opens the screen from a stale page might.
