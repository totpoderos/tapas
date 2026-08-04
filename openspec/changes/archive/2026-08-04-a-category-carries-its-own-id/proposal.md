## Why

A scoring category's id is internal identity — a score is stored against it, the tally groups by it, and a ballot is checked against it — yet nothing in the system owns minting one. Four authoring paths invent ids four different ways, and nothing anywhere checks that a contest's categories have distinct ids.

This is the participant-id bug, one field over. That one was found the hard way: drafts authored by the assistant stored people with `id: undefined`, which made them unaddressable and failed publish with `DUPLICATE_PERSON_ID "undefined"` as soon as there were two. It was fixed by giving the API one place that assigns ids — `withParticipantIds` — and by having `compile` refuse duplicates. Categories got neither.

Today:

- **The two forms mint ids by position** (`c1`, `c2`, `c3`) and re-mint them on every save. Opening a draft and saving it unchanged **renumbers every category**, and the editor discards whatever id the draft already carried.
- **`add_category` mints a real unique id.** So a category added by the assistant is renamed to `c2` the next time the host touches the form — two paths that disagree about what a category's identity is.
- **`create_draft` requires the model to supply one.** An id is not a model's to invent, and the host has never been shown one. A model that reasonably leaves it out is refused outright: `scoring.categories.0.id: Required`, and no contest is created.
- **Nothing checks the ids are distinct.** `compile` refuses `DUPLICATE_PERSON_ID` but has no category equivalent, so two categories sharing an id publish cleanly and then mis-tally: `tally.ts` collects a category's scores by matching `entry.categoryId`, so each of the two would collect the other's as well and both totals would be wrong. The contest reveals a winner decided by doubled scores, and nothing on the way there looks broken.

The last of those is a wrong result presented as a right one, which is the worst failure this app has.

## What Changes

- **A category's id is minted by the API, never by whoever is authoring.** One place, mirroring `withParticipantIds`: a category arriving without an id gets one, and a category that already has one keeps it.
- **`create_draft` stops asking the model for a category id.** It becomes optional in the tool schema, the way a participant's already is — the same reasoning, written down in the same place.
- **The forms stop renumbering.** A category keeps the id it was created with across an edit; only a genuinely new row gets a new one. Renaming a category does not change its identity.
- **BREAKING (rule space) — publishing refuses a draft whose categories share an id**, with a `DUPLICATE_CATEGORY_ID` compile error alongside `DUPLICATE_PERSON_ID`. A draft that could previously be published into a contest that would tally wrongly is now refused with a reason. No existing published contest is affected; compilation happens once, at publish.

Not included, deliberately: reconciling the ids of drafts already stored. Category ids are internal and are only read within one contest, so a draft carrying `c1`/`c2` stays valid and keeps working — the change is to who assigns them next, not a rewrite of what is there. A published contest's categories are already fixed.

## Capabilities

### New Capabilities

<!-- None. This settles behaviour three existing capabilities already claim. -->

### Modified Capabilities

- `assistant-tool-surface`: setting up a whole contest in one go SHALL NOT require the assistant to supply an internal id for a scoring category — the same rule the surface already holds for a contest ("named, never quoted by id") and for a participant, applied to the one place it was missed.
- `validate-and-publish-contest`: publishing SHALL be refused for a draft whose scoring categories do not have distinct identities, stated as the sibling of the existing duplicate-participant rule.

<!--
  `prepare-a-contest` was listed here and has been withdrawn — see design.md,
  "A category's identity has no domain-level observable". Nothing in a draft
  reads a category by id (the only readers are saving a score and gathering a
  tally, both after publish, where categories are already fixed), so "a category
  keeps its identity while a contest is being prepared" cannot be stated as a
  scenario without either naming the id — which the spec-leakage rule forbids —
  or asserting nothing. It is a real invariant and it is now held by unit,
  component and integration tests; it is not a requirement this capability can
  express, and a spec that cannot be tested does not belong in one.
-->


## Impact

- `packages/domain` — `compile` gains `DUPLICATE_CATEGORY_ID` beside `DUPLICATE_PERSON_ID`. Pure, no I/O; a unit test per rule.
- `packages/api` — a `withCategoryIds` beside `withParticipantIds`, applied on every draft write path (`CreateDraft`, `UpdateDraft`) so no caller has to remember it. `AddScoringCategory` already mints correctly and is left alone.
- `packages/mcp` — `create_draft`'s category `id` becomes optional, with the comment `personShape` already carries about why an id is not the model's to invent. `add_category` is unchanged.
- `packages/host-web` — `new-contest.tsx` and `draft-editor.tsx` stop building `c{i+1}` and stop discarding the id a loaded draft carries. The editor already keys its rows with a `freshId()`; the fix is to carry the category's own id rather than re-derive one from position.
- `packages/evals` — a host-assistant case for a whole contest set up in one message, asserting the draft that results is judged on two distinct categories. The eval set has no case that reaches this.
- `tests/e2e` — the publish refusal is a rule-space rejection like the couples one; it belongs with those.
- Related: PR #189 fixed the sibling failure in the same tool call — a scoring range the model wrote the way `set_score_range` takes one. Same shape of bug, same file, one field apart.
