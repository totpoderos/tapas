## Why

A cook who never got round to naming their dish still has a dish in the contest — the roster gives every place a dish slot, and it is scored and it appears on the leaderboard. The API calls it `A dish`.

That string is English, and it is written in the API. It reaches a Spanish participant's reveal untranslated, sitting between dishes that are in Spanish, on the one screen the whole room looks at together. It also reaches the host's results.

There is a second, quieter problem in the same place. The ballot has its own placeholder — `A dish (not named yet)` — so the same dish is called two different things on two screens a participant moves between. That is the shape of this repo's recurring defect: two paths assumed equivalent, agreeing by convention until one is edited. `dishNaming` was extracted to stop exactly this, and the ballot never went through it.

## What Changes

- A dish nobody named SHALL be called by the name of the cook whose it is. Names are data, not interface text — they are never translated, so a name has nothing to go wrong in Spanish. A dish brought by a couple takes both names.
- The ballot stops carrying its own placeholder and builds its naming from `dishNaming`, like both reveal routes already do. One function decides what a dish is called, everywhere.
- Where a dish was never named **and** its cook is not on the roster, the name falls back to an em-dash — the only remaining case, and one with no person and no dish to name. It carries no language.
- The participant reveal stops printing "brought by X" under a headline that is already X.

**Not** a change to who may see what. A voter can already list every dish with its submitters, and the roster is public to anyone holding the join code, so which place has no dish is already derivable by subtraction. This makes an existing disclosure legible rather than making a new one — worth confirming in the pending security review of the participant app's disclosures.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `see-the-results`: what a participant's reveal calls a dish nobody named.
- `host-sees-the-results`: the same, on the host's results — the two must agree, and now do so by construction.
- `read-my-ballot`: what the ballot calls a dish nobody named, and that it is the same thing the reveal calls it.

## Impact

- `packages/api/src/contests/reveal-dto.ts` — `dishNaming.nameOf`, the one place the fallback lives.
- `packages/api/src/scoring/use-cases/get-ballot.ts` — drops its own placeholder, takes the roster, and names through `dishNaming`. Its composition gains a dependency.
- `packages/participant-web/src/reveal-view.tsx` — suppresses the cook line when it would repeat the headline.
- No change to either app's translation resources: the fix removes English from the API rather than adding wording to the apps.
