## Why

The design handoff *Modern administration panel shell* gives a contest being prepared **two** ways in, side by side in the navigation: its **rules** — what the contest is called and how it is scored — and its **participants & pairing** — who is taking part, who is paired with whom, and who may not score whom. The panel ships one. `the-panel-gets-a-modern-shell` named the split as an explicit Non-Goal and said why: "Splitting means new routes, which is a change of its own" (`openspec/changes/the-panel-gets-a-modern-shell/design.md:27`). This is that change.

One screen is not merely off-design, it is hard to work in. Preparing a contest is two different jobs — settling the rules is a decision made once, settling the roster is fiddly and repeated — and today they are a single scrolling form with two columns, where adding the eleventh participant means scrolling past attribution, anti-bias, categories and the score range every time. The navigation cannot say which job a host is doing, because as far as it knows there is only one.

## What Changes

- **A contest being prepared has two sections.** *Rules* holds its name, whether dishes are attributed per person or per couple, the anti-bias rule, the scoring categories, the score range, and whether scores must be unique per category. *Participants & pairing* holds the roster, the couple pairings, and the pairs barred from scoring each other. Nothing is added and nothing is dropped — what is on one screen today is on two.
- **The navigation offers both.** The draft-scoped sidebar's single way in becomes two, under the draft's name, each marked when it is the current one.
- **Edits carry across the two sections, and one save stores them all.** Moving from Rules to Participants does not save, does not warn, and does not lose anything: the draft is read once on the way in and held while the host works on either section. Saving from either writes the whole thing.
- **Saving, publishing and the publish checklist stay on both.** The checklist describes the whole draft, not one section of it, so it belongs wherever the host is standing; and a host who has just finished the roster should not have to navigate somewhere else to go live. What the draft still needs also keeps its place in the navigation, where it is visible without scrolling.
- **Publishing from either section leaves from the same place.** A published contest still lands in its control room with its join code waiting.
- Both sections read in English and Spanish, are operable by keyboard, and are held to the same axe-core gate as the screen they replace.

Not included, deliberately:

- **A "Review & publish" third section.** The mockup's four-step sidebar belongs to the *new contest* wizard, which this change does not build. Splitting publishing off would put a screen between a ready draft and going live for no gain.
- **Splitting the new-contest form.** Creating a contest stays one form and keeps its two honest steps in the sidebar.
- **Rules and Participants ways-in for a published contest.** A live contest's rules are read-only and the control room already shows them, as "Rules in force". These sections exist for a draft.
- Any change to what a draft *is*, to the API that stores it, or to what publishing checks.

## Capabilities

### New Capabilities

- `prepare-a-contest`: how a host works on a contest before it goes live in the panel — that its rules and its people are two sections rather than one screen, what belongs to each, that edits made in one survive moving to the other, that one save stores the whole draft from either, and that saving, publishing and what is still missing are offered wherever the host is standing.

### Modified Capabilities

<!-- None. The shell's navigation requirement already provides for a contest's ways in, and
     `configure-contest`, `create-contest` and `validate-and-publish-contest` describe what a
     draft is and what publishing checks — none of which this change touches. -->

## Impact

- `packages/host-web/src/pages/review-draft.tsx` — split into two surfaces plus the state they share; `review-draft.module.css` divided along the same line.
- `packages/host-web/src/app.tsx` — `/review/:id` becomes a layout route with two children. The child path stays clear of the prefixes the dev/preview proxy forwards to the API (`/auth`, `/drafts`, `/contests`, `/assistant`, `/admin`, `/invites`, `/setup`), as `/review` itself already does.
- `packages/host-web/src/shell/use-panel-nav.ts` and `sidebar.tsx` — the draft navigation gains a second way in and has to say which one is current.
- `packages/host-web/src/i18n/locales/{en,es}/review-draft.json` and the shell's strings — the two section names in both languages; the existing keys move rather than change.
- `tests/e2e/host-draft-review.feature` and its spec — the existing scenarios stay true, and are joined by the ones this change adds; nothing already confirmed is rewritten to accommodate the split.
- No change to `packages/api`, `packages/domain`, `packages/mcp` or `packages/participant-web`: the draft is read and written exactly as it is today.
