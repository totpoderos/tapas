## Context

The rule space of a contest is two independent value objects today —
`Attribution` (`per_person` | `per_couple`) and `AntiBias` (`none` | `couples` |
`arbitrary_pairs`) — plus two relations over the roster: `Person.partnerId`, and
`Person.noScoreWith`. `compile()` (`packages/domain/src/compile.ts`) reads all four
and produces the materialized constraint view that runtime consults.

Six combinations exist; three describe real contests. The other three are either
degenerate (`per_couple` + `arbitrary_pairs` — barred pairs on top of a shared dish),
redundant (`per_couple` + `couples` — the couple's dish already *is* the partner's
dish, so the couples rule can never exclude anything a shared dish did not already
exclude), or misleading (`per_person` + `arbitrary_pairs`, which silently ignores
partners the host has just entered). Because the model cannot say which combinations
are meaningful, the UI has to: hence the standing "not in force" callout on the
barred-pairs card and the spec requirement that mandates it.

The chosen constraint is that only what is *representable* should be *meaningful*.
Replacing the pair of value objects with one three-valued `ContestFormat` does exactly
that: every value of the type is a contest somebody holds, so no screen has to explain
a setting that does nothing.

The compiler is the load-bearing artifact (architecture: rules are compiled at publish
time, never re-interpreted at runtime), so the format has to be a *compiler input* —
not a UI preset that expands into the old two fields behind the host's back. A preset
would keep the six-cell grid alive underneath and leave the same illegal states
reachable through the API, the MCP tools and the assistant.

## Goals / Non-Goals

**Goals:**

- One question with three answers replaces two questions with six combinations.
- Every value of the new type is a contest a host actually wants; no combination needs explaining, warning about, or apologising for.
- `compile()` stays pure and total: for any format plus roster it either compiles or returns a typed error.
- Under `couples`, a roster with anybody unpartnered is a *publish-time* failure with a name, surfaced by the checklist before the host presses publish.
- The rename reaches every entry point at once — HTTP, MCP, assistant — so no path can still set the old fields.

**Non-Goals:**

- Preserving contests or drafts already stored. The columns are replaced outright (settled with the host: clean break, no mapping migration).
- Keeping "chosen pairs cannot score each other" in any form, including as an advanced mode. It is removed.
- Keeping the mixed `per_couple` roster where an unpartnered person cooks alone among the couples.
- Changing scoring itself — categories, range, `uniquePerCategory`, ranking and the vote lifecycle are untouched.
- Allowing a person more than one partner, or a partner relation that is not reciprocal. Both stay as they are.

## Decisions

### 1. `ContestFormat` is a single three-valued type, and it is the compiler's input

```ts
export type ContestFormat = 'solo' | 'solo_with_partners' | 'couples';
```

`Attribution` and `AntiBias` are deleted, not deprecated. `ContestDraft.format`
replaces `ContestDraft.attribution` and `ContestDraft.antiBias`.

*Why not keep the two fields and derive the format for display only?* Because the
illegal combinations would still be reachable through the API, the MCP tools and the
assistant, and the UI's job of explaining them would move rather than end. The point
of the change is to make the illegal states unrepresentable, which only works if the
narrow type is the one the compiler reads.

*Why not two booleans (`sharedDish`, `partnersApart`)?* Four combinations for three
contests, and `sharedDish && !partnersApart` is meaningless — the same defect in a
smaller grid.

*Naming.* `solo_with_partners` is deliberately awkward-but-honest: it is the solo
contest with an exclusion, not a couples contest. Calling it `partners` would invite
confusion with `couples`. The UI never shows these tokens; it shows sentences
(decision 5).

### 2. `compile()` reads the format directly, and the couples rule disappears into the dish

Dish building:

| format | dishes |
|---|---|
| `solo` | one per person |
| `solo_with_partners` | one per person |
| `couples` | one per couple, `submitterIds = [a, b]` |

Exclusion, after the invariant "never score your own dish" has already been applied:

| format | further exclusion |
|---|---|
| `solo` | none |
| `solo_with_partners` | a judge with a partner may not score the dish their partner submitted |
| `couples` | none needed — the partner's dish *is* the judge's own dish, already excluded |

So `isBarred()` collapses from a three-armed switch over `AntiBias` to a single
condition that only `solo_with_partners` can trigger, the symmetric `noScore` map and
its `link()` helper are deleted with `noScoreWith`, and `couples` needs no anti-bias
logic at all. This is the simplification the change is for: the third scenario's
fairness is a *consequence* of the shared dish rather than a second rule that has to
agree with it.

### 3. "Everybody must be partnered" is a compile error, not a UI-only check

New `CompileErrorCode`: `UNPARTNERED_IN_COUPLES`, raised when `format === 'couples'`
and any participant has no `partnerId`. It joins `MISSING_PARTNER` and
`INCONSISTENT_PARTNER` as a partner-integrity failure, so the same publish path that
already refuses a dangling or one-sided partnership refuses this one, with a name a
caller can act on.

Existing `JUDGE_CANNOT_SCORE_ANY_DISH` stays and still does real work: a
`solo_with_partners` contest of exactly one couple compiles two dishes that neither
person may score.

The host-web publish checklist keeps predicting this from the draft alone — it already
counts participants without a partner — but the prediction is now shown only under
`couples`, since that is the only format where a missing partner is a fault rather
than a choice. The server's answer stays authoritative (`prepare-a-contest`: the
checklist is a prediction, not the ruling).

### 4. Storage: one `format` column, replacing both, with no mapping

Migration `0019_contest_format.sql` drops `attribution` and `anti_bias` and adds
`format TEXT`. Nullable, exactly as 0017 and 0018 made those two: a draft that has not
been given a format yet must report nothing rather than be guessed into `solo`, which
is itself a rule. `NOT NULL` is enforced at publish by `compile()`, not by the column.

*Why no mapping migration?* Settled with the host: nothing stored is worth preserving.
A mapping would also have to invent an answer for `arbitrary_pairs`, which has no
image in the new type — inventing one silently is worse than not running.

Note for whoever runs this against a database with rows: this migration is
destructive and irreversible. Rollback is restore-from-backup, not a down-migration.

### 5. The UI asks one question, in sentences, and the partner field follows the answer

The rules section's two radio groups (`attributionLegend`, `antiBiasLegend`) become
one, `formatLegend`, with three choices carried by the existing `Choice` card. Each
choice says what happens rather than naming a rule, because the point of the change is
that a host should not have to hold a grid in their head:

| value | label | help |
|---|---|---|
| `solo` | Everyone on their own | Each person cooks their own dish and scores every other dish. |
| `solo_with_partners` | Everyone on their own, partners kept apart | Each person cooks their own dish. Anyone with a partner doesn't score their partner's dish. |
| `couples` | Couples cook together | Each couple cooks one dish. Nobody scores their own couple's dish, and everyone needs a partner. |

The participants section then follows the format rather than restating it: the partner
select is **absent** under `solo` (there is nothing a partner would do), **offered**
under `solo_with_partners`, and **required** under `couples`, where a person without
one is marked as wanting one exactly as today. The whole barred-pairs card — its
heading, its hint, its list, the `AddPair` picker and the `Callout` — is deleted, and
with it the requirement that mandated the callout.

*Partners entered and then abandoned.* Choosing `solo` after pairing people does not
discard the pairings; they are kept in the draft and simply do the nothing that `solo`
means, and choosing another format brings them back. This is the surviving half of the
old "an idle pair is kept, not discarded" instinct — but it needs no callout, because
a partner under `solo` is not a rule that failed to apply, it is a roster fact the
format has no use for.

### 6. The assistant may not default the format either

`FIELD_SCHEMAS.attribution` and `FIELD_SCHEMAS.antiBias` become
`FIELD_SCHEMAS.format` (`z.enum(['solo','solo_with_partners','couples'])`), and
`PersonSchema` loses `noScoreWith`. The existing proposed-draft guard drops any
`llm_default`-sourced field and asks for a clarification instead; `format` inherits
that treatment unchanged, as does the participant-text injection defense — a name
written to read like an instruction still cannot set the format, and the clarification
now asks about one field rather than two.

This *narrows* the injection surface: two independently settable rule fields become
one, and the arbitrary-pairs list — a free-form set of names an injected instruction
could populate — no longer exists.

## Risks / Trade-offs

- **A host loses the ability to bar three or more people from each other, or to bar a pair who are not partners.** → Accepted deliberately: the host confirmed no scenario needs it, and it is the single largest source of the confusion this change exists to remove. If it ever returns, it returns as a fourth format with its own name, not as a second orthogonal knob.
- **The migration destroys any stored contest.** → Accepted and settled: clean break, no rows worth keeping. Called out explicitly in the migration's own comment so nobody runs it against real data by accident.
- **A wide rename touching nine workspaces at once risks a half-applied change** — an old field name surviving in a DTO, a tool schema or an eval case, compiling fine and failing only at runtime. → Deleting the types rather than deprecating them makes every surviving use a type error; `noScoreWith` and both old enums must not appear anywhere afterwards, and a repo-wide grep for `attribution`, `antiBias`, `arbitrary_pairs`, `per_couple` and `noScoreWith` is part of the verification, not a nicety.
- **Two paths compute "who may score what": `compile()` and the host-web checklist.** → This is the project's recurring parallel-path defect. The checklist stays an explicitly-labelled prediction over what is certain from the roster alone (a `couples` contest with an unpartnered person cannot go live); everything subtler stays the compiler's answer, and the acceptance specs assert the server's refusal, not the checklist's guess.
- **Existing acceptance features are written in the old vocabulary** ("scored per person with couples barred"). → They are rewritten as part of this change rather than left readable-but-wrong; the vocabulary is the contract, and a feature file that names a rule the system no longer has is a lie about the system.

## Migration Plan

1. Domain first: `ContestFormat`, `compile()`, `UNPARTNERED_IN_COUPLES` — pure, no I/O, fully unit-testable ahead of everything else.
2. Storage and API: migration `0019`, DTOs, extraction schema and guard, publish use case, materialized codec.
3. Frontends: host-web rules and participants sections plus the checklist, then the shared DTO in participant-web/ui.
4. MCP tool catalog and eval cases last, as followers of the DTO.

Rollback: revert the commit and restore the database from backup. There is no
down-migration, by decision 4.
