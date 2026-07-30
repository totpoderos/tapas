## Why

The activity log is supposed to answer "did I do this, or did the assistant?". It cannot.

`openspec/config.yaml` describes the intended architecture as "One audit log across all paths, tagged by sourcePath (form|mcp|system)", and the code is built for it: `AuditContext` carries `sourcePath`, `toolName` and `toolArgs`; `CreateDraft`, `RenameDraft` and `UpdateDraft` all take a source parameter; a unit test passes `'mcp'` and asserts the entry records it. None of it is reached. The assistant executes every tool by re-dispatching it through this same API — `app.inject` carrying the host's session cookie — and **no route passes a source through**, so all three use cases take their `sourcePath = 'form'` default whoever is acting. Nothing in the running system has ever written `'mcp'`, a tool name, or tool arguments.

The consequences are visible on screens that just shipped. The activity log offers a **"Connected tool" filter that can never match a row**; its `details` column, and the same detail on screen, are always empty; and an assistant renaming a draft is recorded identically to a host typing the name in. The panel promises a distinction the record cannot make.

This is the shape this repo keeps producing: two paths that agree until one layer diverges, with a green unit test covering the path production never takes. The confirmation marker already solves the same problem for the same dispatch — `x-tapas-confirmation: host` — so the gap is not that the design is missing, only that provenance was never carried the way confirmation was.

## What Changes

- **What the assistant does is recorded as the assistant's.** An action carried out because a host asked the assistant to is recorded with the connected-tool source and the name of the tool that did it, rather than as though the host had used the app directly.
- **What the tool was asked to do is recorded with it.** The arguments the tool was invoked with are kept on the entry, which is what lets a host see *what* an assistant changed a name to and not only that it changed one.
- **Provenance travels in-process, not in a header.** The confirmation marker is a header because it is one fixed word. Tool arguments are model-produced JSON, and serialising that into an HTTP header is a needless surface; since the assistant dispatches in-process, the source travels beside the request instead.
- **Nothing about who may read the log changes.** Ownership, refusals and the file are untouched. This changes only what a recorded action says about itself.
- Not included, deliberately: recording provenance for the **MCP server transport**. It is a separate entry point that does not go through the assistant's dispatch, and giving it real provenance is its own piece of work with its own scenarios. Its actions keep being recorded as they are today rather than being labelled wrongly.

## Capabilities

### Modified Capabilities

- `audit-log-visibility`: an entry now distinguishes an action a host took in the app from one an assistant took on their behalf, and names the tool and the arguments when it was the latter.

## Impact

- `packages/api` — the assistant's dispatch marks what it dispatches; the draft and contest routes read that mark and pass it on; `CreateDraft`, `RenameDraft` and `UpdateDraft` accept the tool name and arguments their `AuditContext` already has room for.
- `packages/host-web` — no change is required. The activity log, its source filter and its details column already render this; they have simply never had data. Their existing tests stop being fixtures for a state the system cannot produce.
- `packages/api/tests` — acceptance scenarios that drive the assistant and then read the log, which is the pairing that would have caught this.
- No migration: `audit_log` already stores `source_path`, `tool_name` and `tool_args`. Rows written before this change stay as they are — an old entry says `form` because that is all that was ever recorded, and it is not restated as something better.
