## Context

The assistant is not a second way into the domain. It runs a tool by turning it into an ordinary API request and dispatching that request back through this same Fastify app:

```ts
const response = await app.inject({
  method: apiRequest.method,
  url: apiRequest.path,
  payload: apiRequest.body,
  headers: { cookie: request.headers.cookie ?? '', ...(hostConfirmed ? { 'x-tapas-confirmation': 'host' } : {}) },
});
```

That is a deliberately good decision — one execution path, one set of ownership checks, no second copy of the rules — and it is why the audit log has no gaps. It is also why the log cannot tell the two apart: by the time the request reaches the route, everything that distinguished it is gone except the cookie.

The pieces to carry it already exist. `AuditContext` has `sourcePath`, `toolName` and `toolArgs`. `CreateDraft`, `RenameDraft` and `UpdateDraft` each take a `sourcePath` parameter that defaults to `'form'`. `packages/api/tests/unit/drafts/use-cases/create-draft.test.ts` passes `'mcp'` and asserts the entry records it, and passes. Only the wiring between the dispatch and those parameters was never built — so the capability is unit-tested and unreachable at the same time, which is the failure mode this repo has hit before.

## Goals / Non-Goals

**Goals.** An action taken through the assistant is recorded as such, with the tool that took it and the arguments it was given. An action taken in the app is recorded as the app's. Both remain the host's action.

**Non-Goals.** The MCP server transport. It is a separate entry point that does not pass through the assistant's dispatch, and the honest thing is to leave its actions recorded as they are rather than label them with a provenance this change does not actually carry for them. Also not in scope: backfilling old rows, and any change to who may read a log.

## Decisions

### Provenance travels beside the request, not inside a header

Confirmation is a header because it is one fixed word from a closed set. Tool arguments are different: they are model-produced JSON of unbounded shape and size. Serialising that into a header means inventing an encoding, worrying about header size limits, and putting untrusted text somewhere a proxy might log or truncate it — for data that never leaves this process.

**`AsyncLocalStorage` was the first plan, and it does not work here.** `app.inject` routes the request through light-my-request, which crosses a stream boundary that drops the async context: the handler sees an empty store. This was verified with a probe before anything was built on it, rather than assumed from the fact that the dispatch is in-process.

What ships instead keeps the goal and drops the mechanism. `dispatchedAs()` mints a random ticket, holds `{ sourcePath: 'mcp', toolName, toolArgs }` against it in an in-memory map, and hands the caller a header carrying **only the ticket**. The route looks the ticket up through one accessor, which is also the single place deciding that an unknown or absent ticket means the app. The entry is removed in a `finally`, so a ticket cannot outlive its dispatch.

So the model-produced JSON still never becomes a header; what crosses the boundary is an opaque id. A forged ticket buys nothing: it names no live entry unless guessed within the microseconds one exists, and even then the only effect is mislabelling the guesser's own action in their own log.

*Alternative considered:* a header carrying the JSON directly. Rejected for the reasons above. *Alternative considered:* passing the context down as a function argument from the assistant to the use cases. Rejected — that is the second execution path this design exists to avoid.

### The route decides the source; the use case is told it

The use cases already accept a source; they should not learn where it comes from. The routes read the ambient context and pass it, exactly as `confirmationFrom(request)` already does for the confirmation marker. That keeps HTTP concerns in the HTTP layer and leaves the use cases testable by being handed a value.

### An assistant's action stays the host's action

`actorId` continues to be the signed-in host. Provenance answers *how* an action arrived, not *who* is answerable for it — the assistant has no identity of its own, holds no authorization, and acts only within the host's session. A log that named the assistant as the actor would say something untrue about accountability, and would break the "who acted" reading every existing scenario depends on.

### Old rows are left alone

`audit_log` already has `source_path`, `tool_name` and `tool_args`, so there is no migration. Entries written before this change say `form` because that is all that was ever recorded. They are not rewritten and not reinterpreted: "recorded as coming from the app" is what the record says, and guessing which of them were really the assistant's would be inventing history.

## Risks / Trade-offs

- **The carrier was wrong on the first attempt, and only an end-to-end test showed it.** `AsyncLocalStorage` looked obviously right and silently carried nothing across `inject`. The acceptance scenarios drive the real assistant and read the real log, so the mechanism is never trusted on the strength of a unit test of its own accessor — which is the same mistake that let the original gap sit behind a green `create-draft` test.
- **A second entry point still lies by omission.** The MCP server's actions keep being recorded as `form`. That is a known, stated limitation rather than a hidden one, and it is narrower than today's situation, in which the assistant lies too.
- **The panel's "Connected tool" filter starts matching rows for the first time.** Its rendering is already built and unit-tested; what changes is that the state becomes reachable, so the browser tests for the log gain real data to narrow.
