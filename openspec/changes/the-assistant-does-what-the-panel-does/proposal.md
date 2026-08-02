# The assistant does what the panel does

## Why

A host can prepare a whole contest in the panel — choose its format, name what
it is judged on, decide how it is scored, pair people up — and can do almost
none of that by asking. The assistant can start a draft and add or remove the
people in it; every other rule it can only set at the moment of creation, and
never change afterwards. As the rules grew (a contest has one format, scoring
carries a range and a uniqueness choice), the assistant stood still, so the two
ways of working drifted apart until asking became the poorer one.

It also makes the host speak the machine's language. Nine of the fifteen tools
are addressed by an internal id, so answering "close Tapas Night" means finding
the contest, reading an id back out, and quoting it — an id no host ever sees on
screen, says aloud, or should have to hold on to. A host refers to a contest by
its name; the surface should too.

## What Changes

- The assistant gains the draft edits the panel already has, as small
  verb-first tools — one operation each, rather than one tool that rewrites a
  draft wholesale: set the format, add and remove a scoring category, set the
  score range (automatic, or fixed between two numbers), choose whether a score
  may be used once per category, and pair two people as partners.
- **BREAKING** Every tool that took a `contestId` or `draftId` now takes the
  contest's **name** instead: `get_contest`, `get_draft`, `get_tally`,
  `close_contest`, `publish_contest`, `trigger_reveal`, `delete_contest`,
  `get_results` and `update_draft`. The id-addressed forms are removed, not kept
  alongside — two ways to name the same contest is one way too many for a model
  to choose between. Any external MCP client passing ids must be updated.
- A name that several contests share resolves the way it already does elsewhere:
  the candidates come back so the assistant can ask the host which one is meant.
  A name matching nothing comes back empty. This becomes the single rule for the
  whole surface rather than a habit of three tools.
- Removing a scoring category is treated as destructive, like removing a person:
  the assistant asks the host to confirm before it happens.
- `update_draft` is renamed to `rename_contest`, which is what it actually does.

Deliberately **not** in scope: the close rule and the reveal strategy. The panel
does not edit either — `create_draft` accepts them and no screen changes them —
so adding them to the assistant would make it do *more* than the panel, which is
not what this change is for. Editing stays a draft-only affair, exactly as in
the panel: once a contest is published its rules and its people are settled.

## Capabilities

### New Capabilities

None. This widens a surface that already exists rather than introducing a new
one.

### Modified Capabilities

- `assistant-tool-surface`: gains requirements for editing a draft's rules
  (format, scoring categories, score range, score uniqueness, partners) through
  a connected assistant, and changes how every existing tool addresses a
  contest — by name, with the shared "several share a name" resolution — where
  the requirements today are written around reading and a narrow set of writes.
- `converse-with-the-host-assistant`: the panel must show the results of the new
  edits and must be able to ask which contest is meant for any action, not only
  the three that can ask today.

## Impact

- `packages/mcp/src/tool-catalog.ts` — the shared catalogue: new tools, and the
  id→name change on nine existing ones. Both entry points read this one file, so
  the MCP server and the in-app assistant move together by construction; that is
  the seam this repo has watched diverge before, and it stays single here.
- `packages/api` — the adapter is a thin protocol translator and must stay one,
  so each new operation needs an API endpoint of its own rather than a
  read-modify-write in the adapter. Expect new draft routes and one use case per
  operation, alongside the name→contest resolution the existing by-name routes
  already do.
- `packages/host-web` — the chat panel renders tool results; new results need
  saying in words, and the "which one did you mean?" path widens.
- `packages/api/src/llm/keyword-stub-llm-client.ts` and the E2E chat specs — the
  deterministic stub steers the E2E loop and must learn the new calls.
- `packages/evals` — the host-assistant eval cases exercise the tool surface; the
  renamed and re-addressed tools change what a correct call looks like.
- Documentation: the tool surface is described in `design.md` §6 and the
  assistant's reach is part of the security story (a wider write surface behind
  the same host-scoped token and the same confirmation gate).
