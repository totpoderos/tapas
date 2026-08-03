## Context

A `Category` is `{ id, name }`. The name is the host's; the id is the system's — `save-score` stores against it, `score-check` validates a submitted score against it, and `tally.ts` gathers a category's totals by matching `entry.categoryId !== category.id`. It is real identity with real consequences, and no single place mints it.

Four authoring paths, four policies:

| Path | What it does with a category id |
|---|---|
| `host-web/pages/new-contest.tsx` | mints `c${i+1}` from the row's position at save |
| `host-web/pages/draft/draft-editor.tsx` | reads only `cat.name` from the loaded draft, then re-mints `c${i+1}` — the stored id is discarded on every save |
| `AddScoringCategory` (assistant `add_category`) | mints `ids.next()`, a real unique id |
| `create_draft` (assistant, one-shot) | requires the model to supply one; refuses the call without it |

And `compile` has `DUPLICATE_PERSON_ID` but no category equivalent, so nothing catches the collision the first two paths can produce.

The participant version of this was fixed once already. `withParticipantIds` is the shape of the answer and its comment is the argument for it; this change applies the same answer to the field beside it.

## Goals / Non-Goals

**Goals:**

- One place assigns a category id, on every draft write path, so no caller has to remember to.
- A category id, once assigned, survives every edit — including a save from either form.
- `create_draft` stops asking a model for identity it has no business inventing.
- A draft whose categories collide is refused at publish rather than tallied wrongly.

**Non-Goals:**

- Rewriting the ids of drafts already stored. Category ids are read only within one contest, so `c1`/`c2` in an existing draft stays valid — what changes is who assigns them next.
- Touching published contests. Compilation happens once, at publish; a live contest's categories are already fixed and are not revisited.
- Showing a category id to a host anywhere. It stays internal; that is the whole point.
- Making category *names* unique. `AddScoringCategory` already refuses a duplicate name through the assistant, for its own reason (the assistant addresses a category by name). Names on the form are a separate question and are not opened here.

## Decisions

### The API assigns the id, not the client

`withCategoryIds(content, ids)` beside `withParticipantIds`, applied in `CreateDraft` and `UpdateDraft` — the two writes every draft passes through. A category with an id keeps it; one without gets `ids.next()`.

*Why here:* it is where the participant fix went, and for the same reason its comment gives — every write path already passes through, so "a stored category has an id" holds by construction rather than by four callers agreeing. It also means the fix lands once for the forms, the assistant, and any path added later.

*Alternative — mint in the domain (`Draft.create`):* rejected. `packages/domain` has zero I/O deps by rule and an `IdGenerator` is a dependency; the participants precedent already put this in the API for that reason.

*Alternative — let each client mint properly:* rejected. That is today, with four clients and four answers.

### The forms carry the id they loaded rather than deriving one

`draft-editor.tsx:109` already maps loaded categories into rows keyed by a `freshId()` — the row key and the category id are two different things, and the fix is to keep the category's own id on the row rather than re-derive one from position at save. `new-contest.tsx` is creating, so it has no id to keep: it can simply send names and let the API assign, which is the smaller change and the one that cannot drift.

*Note:* this is what makes the `prepare-a-contest` requirement true. Without it the API would assign good ids and the form would overwrite them with `c1`, `c2` on the next save — the two halves have to land together or the bug survives.

### `create_draft`'s category id becomes optional

The same one-line change `personShape` already carries, with the same comment. The tool schema is the LLM boundary; the API is the authoritative validator and now assigns what is missing.

*Consequence:* a model that omits the id is no longer refused with `scoring.categories.0.id: Required`. That refusal is the reported failure mode of the sibling range bug (PR #189) one field over.

### Duplicates are refused at publish, not at the edit

`DUPLICATE_CATEGORY_ID` joins `CompileErrorCode`, checked in `compile` the way `DUPLICATE_PERSON_ID` is.

*Why publish and not the write:* this repo's rule is shape at the edit, coherence at publish. A draft is a halfway state and may be incoherent; publishing is where coherence is settled, and where the constraint view is built. It is also the one place every path converges, so the check cannot be dodged by authoring another way.

## Risks / Trade-offs

- **The forms and the API must change together.** → If the API assigns ids but `draft-editor` still re-mints `c{i+1}`, every save silently reverts the fix and the `prepare-a-contest` scenarios fail. The acceptance test for "a category added through the assistant survives a save on the form" is the one that catches it; write it before either half.

- **A draft stored today may already have colliding category ids, and would now be refused at publish.** → That draft would have produced a wrong reveal. Refusing it with a reason is the intended outcome, not a regression — but the refusal message has to name what is wrong in the host's language, or they cannot act on it. Real drafts are unlikely to be affected: `c{i+1}` collides only across a merge of two category lists, which no path currently does.

- **`withCategoryIds` on `UpdateDraft` runs on every save.** → It is a map over a handful of categories; the cost is nothing. The risk is the opposite one — forgetting to apply it on a write path added later. Mitigated by putting it where `withParticipantIds` already is, so the next person finds both together.

- **A model could still send two categories with the same id it invented.** → Which is exactly what the publish check is for. The optional id removes the pressure to invent; the compile check catches what is invented anyway.

## Migration Plan

No data migration. Existing drafts keep their ids; existing published contests are untouched. The change is forward-only: the next write assigns what is missing, and the next publish checks what is there.

Rollback is reverting the branch — nothing is written in a shape an older build could not read, because the shape is unchanged. Only the provenance of the value changes.

## Open Questions

- Should `new-contest.tsx` send categories with no ids at all, or should the client keep minting proper unique ids and the API only fill gaps? Sending names is simpler and puts identity in one place; the counter-argument is that the form then cannot refer to a category it has just created until the round-trip returns. Nothing in the current form needs to, so the simpler option is assumed — revisit if the rules section grows an interaction that does.
- The `DUPLICATE_CATEGORY_ID` message wording, in both EN and ES. It should name the thing being judged on, not the id.
