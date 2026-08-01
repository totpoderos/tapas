## Context

`ReviewDraft` is one 787-line component behind one route, `/review/:id`. It fetches the draft, holds twelve pieces of `useState`, renders a two-column form — rules and roster down the main column, publish checklist and barred pairs down the aside — portals Save and Publish into the panel's header through `PanelActions`, portals what the draft still needs into the navigation through `PanelNote`, and writes everything back with one `PUT /drafts/:id`. The API has no partial update: `PATCH` is rename-only, `PUT` is a full-content replace (`packages/api/src/http/draft-routes.ts:135`).

The design bundle draws this as two sidebar items — *Rules* and *Participants & pairing*. `the-panel-gets-a-modern-shell` shipped one, and said why in its Non-Goals: "Splitting means new routes, which is a change of its own" (`design.md:27`). Everything that split needs is already in place — the shell, the portals, the derived navigation — so this change is routing and state, not chrome.

Three constraints carry over unchanged. The panel hard-gates axe-core in Playwright, and this change doubles the number of screens under that gate. Every string exists in English and Spanish. And browsable routes must stay clear of the prefixes the dev/preview proxy forwards to the API — `/auth`, `/drafts`, `/contests`, `/assistant`, `/admin`, `/invites`, `/setup` — which is why draft review is at `/review/:id` and not `/drafts/:id` in the first place.

## Goals / Non-Goals

**Goals:**

- Two sections, two ways in, each marked when current — matching the mockup.
- One read of the draft on the way in, one write on save, whichever section the host is on.
- No unsaved work lost, and no dialogue asking about it: moving between the sections is not leaving.
- Save, Publish and the publish checklist available from both, unchanged in behaviour.
- Every scenario in the confirmed `tests/e2e/host-draft-review.feature` stays true.

**Non-Goals:**

- A third "Review & publish" section. Confirmed with the user: the checklist rides along on both.
- Splitting the new-contest form into the mockup's four-step wizard. Still one form, still two honest steps in the sidebar.
- Rules and Participants ways-in for a *published* contest — a live contest's rules are read-only and the control room already shows them as "Rules in force".
- Autosave, dirty-tracking, or a leave-the-draft warning. None exists today and none is added; the split does not create the need for one, because the provider below is exactly what stops it.
- Any change to the draft's shape, to `PUT /drafts/:id`, or to what publishing checks.

## Decisions

### A layout route owns the draft; the two sections are its children

`/review/:id` becomes a layout route rendering `DraftWorkspace`, with two children: an index route for the rules and `people` for the participants. So `/review/:id` and `/review/:id/people`.

The index route matters more than it looks. Every existing link into draft review — the contest list's Review action, the assistant, the redirect after saving a new contest — points at `/review/:id`, and each keeps working and lands on the rules. No link elsewhere in the app changes, and no old bookmark breaks.

`people` as the child segment: `participants` would read better, but the segment is nested under `/review`, so proxy collision is not in play and either is safe. `people` is chosen for being short and for already being the panel's word (`/people`, `shell.people`).

*Alternative considered:* two sibling routes, `/review/:id` and `/review-people/:id`. Rejected — nothing in the address would say the two are the same draft, and React Router's nested `<Outlet/>` is what makes the shared state below fall out for free rather than being wired by hand.

### The draft is loaded, held and saved by the layout, not by either section

`DraftWorkspace` does everything `ReviewDraft` does today except render the fields: it fetches on mount, holds the edit state, derives the checklist, portals Save/Publish into the header and the note into the navigation, submits, and publishes. It exposes the state through `DraftEditorContext`, and each section reads what it needs with `useDraftEditor()`.

This is the whole answer to "edits carry across". The state lives above both sections, so moving between them unmounts a set of fields and mounts another — the draft itself is never unmounted, never re-fetched, and never reconciled. There is no dirty flag, no beforeunload, and no prompt, because there is nothing to lose. It is also the answer to "one save stores everything": `buildContent()` reads the same state whichever section is mounted, so `PUT` carries both sections every time, exactly as the single screen does now.

*Alternative considered:* two independent screens, each fetching and saving the full draft. Rejected in the confirmation with the user, and on the merits: two GETs where one will do, a second full-content `PUT` racing the first, and a leave-warning dialogue invented solely to paper over the split.

*Alternative considered:* lifting the state into `ContestsProvider`. Rejected — that provider is the contest *list*, read by the sidebar on every screen; a draft's in-progress edits have a narrower life and belong to the route that owns them.

### One `<form>`, owned by the layout, wrapping the `<Outlet/>`

The header's Save is a portalled `<Button type="submit" form={FORM_ID}>`, which works because a submit button outside its form may name the form it belongs to. That only keeps working if there is exactly one form and it is an ancestor of whichever fields are mounted — so the `<form id={FORM_ID}>` moves up into the layout and the `<Outlet/>` renders inside it. Each section renders fields, never a form.

Two forms — one per section — would mean the header's Save has to know which section is mounted to name the right one, which is the coupling this layout exists to remove.

### The aside is the checklist and only the checklist; barred pairs moves into the roster

Today the aside carries two cards: the publish checklist and the barred pairs. The checklist describes the whole draft and is required on both sections, so the layout owns it and renders it beside the `<Outlet/>`. That leaves barred pairs, which describes the *people* — so it moves into the participants section's main column, next to the roster it is about.

This is a better home for it than the aside was. Barring a pair is primary work on that section, not a sidebar summary of it, and putting it beside the roster means the names being barred and the names being paired are read in one place.

*Alternative considered:* let a section contribute extra cards to the layout's aside, through a third portal. Rejected — a third portal for one card, and an aside whose contents depend on the route, is more machinery than moving a card.

### The navigation's draft scope gains a second way in, and `PanelNav` gains a discriminator

`PanelNav`'s draft arm is `{ kind: 'draft'; draftId; current: 'review' }` with one value, so `current` never does any work. It becomes `current: 'rules' | 'people'`, and `HOST_ROUTES` matches `/review/:id/people` **before** `/review/:id` — `matchPath` on the shorter pattern would otherwise claim the longer path and mark the wrong item current.

`DraftScope` then draws two `Way`s where it drew one. The existing `shell.reviewDraft` string ("Rules & participants" / "Reglas y participantes") is replaced by `shell.draftRules` and `shell.draftParticipants` in both languages.

### The create form hands the people over rather than asking for them

**Added after review.** With a section of its own for participants, `/new` asking
for them as well is the same question in two places — and a host who answers it in
both has to have the answers reconciled. The form keeps the rules and drops the
roster.

The header becomes **Cancel · Save as draft · Next**. Both save; they differ in
where they leave the host — *Save as draft* at their contest list, *Next* on the
new contest's participants and pairing. `Next` therefore needs the id the API
returns from `createDraft`, which it already returns and the form already
discarded. Both go through the same validation, so a nameless contest is refused
identically whichever is pressed.

*Alternative considered:* `Next` alone, with saving implied. Rejected — the sidebar
note promises "only a name is required to save", and a host who wants to name a
contest and stop should not have to go forward to do it.

The step names change with it: *Set it up* / *Review & publish* become **Rules** /
**Participants & pairing**, the two sections' own names. A host now meets one pair
of names from the first form through to publishing, instead of two vocabularies for
the same two screens. *Review & publish* was already the weaker of the two, because
publishing is a button on both sections rather than a screen of its own.

One thing this deliberately does not do: the **assistant** still extracts a whole
draft from a chat message, participants included, and that keeps working — those
people appear on the participants section as they always did. Only the form stops
asking. Two paths that agree until one diverges is this repo's recurring bug shape,
so it is worth saying plainly that this divergence is the intended one: the form is
a step in a sequence, the assistant is a single shot at the whole thing.

### A refused save has to say so where the host is standing

**Found while implementing.** The name is typed on the rules, and `onSave` refused a
nameless draft by setting the field's own error. Split across two sections that
leaves a host who saves from the participants with a save that silently does
nothing — the only explanation is on a screen they are not looking at.

The reason is now said twice: beside the field, as before, and in the workspace's
`role="alert"` callout, which is above the outlet and therefore on both sections.
The checklist already said "A name is still needed" in both places, but a checklist
item is a standing description of the draft, not an answer to the button that was
just pressed.

*Alternative considered:* send the host to the rules and focus the name field. Rejected —
moving somebody who pressed Save somewhere they did not ask to go, to show them a
field, is a bigger surprise than telling them where they are.

### "Saved." now clears on any change, not only on a change of name

**Found while implementing.** `setName` cleared the saved acknowledgement and no
other setter did, so editing a category after saving left "Saved." standing over an
unsaved change. On one screen that was a small lie. Across two sections it becomes a
reliable one: save on the rules, move to the participants, remove somebody — and the
header still says "Saved."

The provider counts every change as a `revision`, and the workspace remembers which
revision it saved. `saved` is the two being equal, so any edit anywhere retires the
note. This is a behaviour change beyond the split, made because the split is what
turns the existing looseness into something a host would actually be misled by.

### The breadcrumb named the draft, and nothing was watching it

**Found in the live look, not by the suite.** `TopBar` built its breadcrumb from
`shell.reviewDraft` — the key this change removes — so the header read the literal
text `shell.reviewDraft`. i18next echoes a missing key back as its own name, so
nothing threw, nothing failed, and the whole test suite was green over a screen with
a raw key printed across the top of it.

It now names the *section*, which is the useful thing anyway: the crumb before it
already names the contest. Two tests were added, and both were checked to fail
against the unfixed code — one on the header of a draft's participants, and one that
walks every host surface asserting nothing shaped like a translation key appears
anywhere on it. The second is the one that generalises; the header had no coverage
at all, which is the actual reason this got through.

### `NavLink` was marking more than one way in as current

**Found while implementing**, by the sidebar test for the new sections. `Way` passes
`aria-current` explicitly and its comment says which one is current is decided here
rather than by router matching — but it rendered a `NavLink`, which sets its own
`aria-current="page"` whenever the address merely *starts* with its `to`. So on a
draft's participants, the way to its rules was announced as current as well.

The bug is not new and not confined to drafts: on the contest list all four state
filters share the pathname `/`, so all four were announced as current. Nothing in
`Way` ever read `NavLink`'s active state — the className is a plain string — so
`NavLink` contributed only the over-marking. It is a `Link` now, which is what the
comment always described.

*Alternative considered:* keep `NavLink` and pass `end`. Rejected — it fixes the draft
case and leaves the query-string case, because `end` compares pathnames and the four
filters share one.

### The existing e2e feature is extended, not rewritten

`tests/e2e/host-draft-review.feature` is confirmed and every one of its scenarios stays true of the split — a host still pairs two people, still bars a pair, still cannot save without a name, still lands in the control room on publishing. What changes is which section the steps happen on, and that lives in the step definitions, not the feature. New scenarios are appended for what the split introduces: two ways in, current marking, edits surviving a move, one save across both, and publishing from either.

The rule from the shell change holds here too: a green suite is not renegotiated to accommodate the redesign. Where a selector breaks because a field moved sections, the fix is the selector.

### Two sections mean two axe runs, not one

`host-draft-review.spec.ts` runs axe on the single screen. Splitting silently halves that coverage unless both sections are scanned, so the accessibility scenario runs against each. The same applies to the keyboard pass and to the Spanish pass, which now also has the two navigation labels to check.

## Risks / Trade-offs

- **The layout becomes the component `ReviewDraft` was, minus the fields** → it is smaller than today's 787 lines because the two field sets leave, and what stays is one job: own the draft. The sections become field-rendering components with no fetching and no submitting.
- **A route now decides where a field lives, so a field can end up on neither section** → the two sections are built by moving markup, not retyping it, and `buildContent()` stays untouched; a field dropped from both would fail the existing "saving stores what was typed" scenarios.
- **`matchPath` ordering is a silent failure** — the wrong item marked current, no error → the ordering is stated above, and the sidebar unit test asserts the participants item is current at `/review/:id/people`.
- **Doubling the screens under axe doubles the chance of a violation slipping in** → both sections are scanned in the same scenario, so neither can ship unscanned.
- **`shell.reviewDraft` is removed while `the-panel-gets-a-modern-shell` is still open** (83/85 tasks, awaiting its manual pass and archive) → the key is used in exactly one place, `DraftScope`, and both changes touch `sidebar.tsx`. This change lands after that one is archived, or rebases onto it; it does not proceed in parallel on the same file.
- **A host on the participants section who publishes an incomplete draft is told why, on a section that may not show the offending field** → the checklist is on both sections and names what is missing, and the navigation's note says it too. The message is the API's own, as it is today.

## Migration Plan

Nothing to migrate: no stored data changes shape, and no API changes. `/review/:id` keeps meaning what it meant, so existing links and bookmarks resolve to the rules section. Rolling back is reverting the change; a draft saved through either section is byte-identical to one saved through the single screen.

## Open Questions

- The mockup shows the two items plain under the draft's name. If they should instead be numbered steps — "1 Rules · 2 Participants & pairing", matching the new-contest scope's step treatment — that is a small change to `DraftScope` and no change to anything else. Drawn plain here, because a draft is edited in any order and numbering would imply a sequence that is not enforced.
