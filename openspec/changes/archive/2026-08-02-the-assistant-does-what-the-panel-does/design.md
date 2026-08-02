## Context

The tool catalogue in `packages/mcp/src/tool-catalog.ts` is read by both entry
points that reach the assistant: the MCP server (which hands `inputSchema` to
the SDK) and the in-app assistant (which validates with `parseToolArguments` and
dispatches itself). Keeping the catalogue single is what stops those two paths
diverging, and this change must not weaken that.

The adapter is deliberately thin: `toRequest` is a pure mapping from validated
arguments to one API request. It holds no business logic and makes no second
call. That constraint is what decides most of what follows — every new operation
needs somewhere in the API to land, because the adapter is not allowed to read a
draft, change a field and write it back.

Today the API already addresses two things by name: `GET /contests/details?name=`
and the draft-participant routes, which take a `contest` name and answer with
either the change or a list of candidates. That is the pattern to generalise, not
to invent.

## Goals / Non-Goals

**Goals:**

- Every host-facing tool addresses a contest by name, with one shared resolution
  rule, and no tool takes an internal id.
- The assistant can change every draft rule the panel can change, one operation
  at a time, without restating the draft.
- The MCP server and the in-app assistant gain all of it from the same catalogue
  entry, with no per-path special-casing.
- The panel reports the new results without a growing table of tool names.

**Non-Goals:**

- The close rule and the reveal strategy. The panel does not edit them.
- Editing a published contest. Rules settle at publish, as they do in the panel.
- Any change to how the rule compiler validates a draft at publish. The API stays
  the authoritative validator; this change only adds ways to reach it.
- Backwards compatibility for id-addressed tools. They are removed.

## Decisions

### Name resolution happens in the API, once, not in the adapter

Each by-name route resolves the name itself, reusing the existing
`find-contests-by-name` use case, and answers with one of three shapes: the
result, the candidates, or nothing found.

*Alternative considered:* let the adapter call `find_contest` first and then the
id-addressed route. Rejected — that is two API calls and a decision between them,
which is business logic in a component defined as having none, and it would exist
only on the MCP path unless duplicated into the in-app assistant. That is exactly
the two-paths-diverge shape this repo keeps paying for.

A single shared resolver in the API means the rule ("exact, case-insensitive,
host's own only, several → candidates") is written once and cannot drift between
operations.

### One endpoint and one use case per operation

`set_format`, `add_category`, `remove_category`, `set_score_range`,
`set_score_uniqueness` and `set_partner` each get their own route and their own
use case, in the style the draft-participant routes already establish, rather
than sharing a generic "patch this field" endpoint.

*Alternative considered:* keep `PUT /drafts/:id` and have the assistant send the
whole content. Rejected for the reason the tool shape was decided: a model that
omits a field silently erases it, and the failure is invisible until publish.
Whole-content replacement stays what the panel's editor uses, where a human sees
the whole form before saving.

Each use case loads the draft, applies one change, and saves — so "changing one
rule leaves the others alone" is true by construction rather than by the caller's
diligence.

### People are named too, not identified

Inside a draft the assistant refers to a person by their display name, since that
is what a host says. Display names are not guaranteed unique within a draft, so
the same three-way answer applies: one match acts, several return the candidates,
none reports nothing found. Participant ids stay internal, assigned by the API as
they are today.

This matters most for `set_partner`, which names two people and must pair them
both ways — and must clear whatever partner either of them had, or the draft ends
up with a one-sided partnership the compiler will reject at publish with a reason
the host cannot connect to what they asked for.

### The panel renders by result shape, not by tool name

`chat.tsx` currently keys its rendering off sets of action names
(`CONTEST_LIST_ACTIONS`, `DETAILS_ACTIONS`). With roughly twenty tools that table
becomes a second catalogue to keep in step with the first — and the moment it
falls behind, a real change renders as a bare "done" ticket.

Instead the panel decides from the shape of what came back: candidates render as
a choice, a draft's details render as details, a refusal renders as a refusal.
New tools returning familiar shapes then need no panel change at all.

### Removing a category is destructive; setting a rule is not

`remove_category` carries `destructive: true` and so goes through the existing
confirmation-token flow, exactly as `remove_participant` does. Setting a format,
a range or a uniqueness choice is reversible by setting it again, so it happens
directly. This keeps the confirmation gate meaning "you are about to lose
something" rather than "you are about to change something", which is what makes
hosts read it.

### `update_draft` becomes `rename_contest`

The tool only ever renamed. Its name promised more, and a model reading the
catalogue would reasonably reach for it to change any part of a draft. Renaming
it is part of making the catalogue honest enough for a small model to navigate.

## Risks / Trade-offs

- **The catalogue grows to roughly twenty tools, and a small local model has to
  choose among them.** → The verb-first names are the mitigation the tool shape
  was chosen for; beyond that, the host-assistant eval set is what actually
  measures tool-choice accuracy, and it must be extended with cases for the new
  operations before this can be called done. If accuracy drops, that is a real
  finding about the model, not a reason to re-merge the tools.

- **BREAKING: any external MCP client passing an id stops working.** → The surface
  is pre-1.0 and the only known clients are the in-app assistant and the user's
  own MCP configuration. Nothing carries the change silently: an id passed where
  a name is expected either finds no contest or is refused by the schema, never
  acts on the wrong one.

- **Confirmation tokens are an HMAC over the tool arguments, so tokens issued
  before the change do not validate after it.** → They are short-lived and
  per-action; a host mid-confirmation is asked again. No migration needed.

- **More write surface behind one host-scoped token.** → Unchanged in kind: every
  new route is host-scoped, ownership-checked in the API as A01 requires, and
  audited on the same projection with `sourcePath` marking it as assistant work.
  The wider reach is the point of the change; the gate around it does not move.

- **The panel's shape-driven rendering could mis-read an unfamiliar shape as a
  familiar one.** → Shapes are discriminated on a field that only that shape has,
  and the fallback is the plain ticket the panel already shows, so the worst case
  is a terse but truthful report.

## Migration Plan

No data migration — this is a surface change over existing state. Ship it as the
sub-slices in `tasks.md`, each its own PR: the addressing change first (it touches
the most existing tools and its tests protect everything after it), then the rule
edits, then the panel and the evals. Rollback is per-PR revert; nothing persists
in a new shape.

## Open Questions

- Should `add_category` accept several categories at once? A host saying "judge it
  on taste, presentation and originality" is one sentence and three calls. Left
  singular for now, matching the panel's one-at-a-time chip input; revisit if the
  eval set shows the model losing track partway through a list.
