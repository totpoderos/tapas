# Backlog

What is known to be missing, and why it is written down here.

Until 2026-07-28 this lived as unchecked boxes in `openspec/changes/tapas-contest-app/tasks.md` — the change that carried the whole build. That change was archived (it was never going to reach 85/85 as a single unit, and its specs describe behaviour that is built), which took the remaining items off the board entirely. This file is where they live now.

**How to pick something up:** `/opsx:propose <describe it>`, then `/opsx:apply`. Each item below is its own change. Nothing here is tracked by an active OpenSpec change — `openspec list` is deliberately empty.

**What the system currently does** is `openspec/specs/` — 22 capabilities, 104 requirements, `openspec validate --specs --strict` clean. That, not this file, is the record of built behaviour.

---

## Needs a person, not an agent

### Screen-reader listening pass (was task 6.12)

The only item deliberately left unchecked at the end of Phase 6, and it stays open for a reason no amount of automation closes.

Semantics are verified — axe hard-gates every E2E run at WCAG 2.1 AA, roles and accessible names are asserted throughout, Lighthouse reports 100/100 on four screens, keyboard operability is covered by every spec. **None of that is listening.** Correct semantics are necessary but not sufficient: only a real screen-reader session reveals whether announcements are timely, ordered, and not exhausting.

Do the participant app first on a phone (TalkBack or iOS VoiceOver) — it is mobile-first and used at a venue — over join → dish → score → send → reveal. Then NVDA on the host app.

Written up with the other honest limits in [`docs/accessibility.md`](accessibility.md) §4.

---

## Features that were planned and never built

### Tie resolution (was 5B.6b)

A tie currently surfaces as joint winners and is never resolved — which is correct behaviour, not a bug, but the host has no way to break one if they want to. Needs real new ground: domain support for resolving a tie, a use case, an endpoint, host UI, and an MCP tool. The largest item here.

### Send a reminder (was 5B.6c)

No way to nudge participants who have not sent their votes. Needs a notifier — a genuinely new outbound concern, since no notification infrastructure exists — plus a use case, an endpoint, and host UI.

### PWA: installable and offline-tolerant (was 5C.5)

The participant app is mobile-first but not installable. Needs a manifest and a service worker, offline-tolerant over cached contest state. Consolidated here from 5C.1, which delivered everything else in that slice.

### The `admin` role and `requireRole()` (was 2.7b)

Three roles were designed (`admin` / `host` / `voter`); two exist. Ownership checks — the primary control under OWASP A01 — are enforced everywhere and are the load-bearing part; what is missing is the `admin` role itself and a `requireRole()` middleware.

**Deliberately parked by the project owner.** Do not start it without asking.

---

## Known rough edges

### The assistant answers "who won?" with dish identifiers

`get_results` hands the assistant the raw `ResultsDto` — dish ids and totals, no names — so a host asking the assistant who won gets a UUID. Both apps read results by name (`toRevealDto`); only the assistant does not. Flagged as a separate change when the host results screen was built.

### WebKit covers only the participant app

`playwright.config.ts` runs a `webkit-participant` project scoped to the participant journey, because that app is mobile-first and every iOS browser is WebKit underneath. The **host app has no second-engine coverage**, and its session cookie had the identical Safari defect that prompted adding WebKit in the first place (see [`docs/threat-model.md`](threat-model.md) §3.4).

### Duplicated links in the participant navigation

The prominent calls-to-action (`Score the dishes →`, `See the results →`) now sit alongside the same destinations in the shared `WaysOnward` nav. Harmless, but real clutter on a 320px screen. Left in place rather than removed unilaterally.

### Confirmation tokens are replayable

`packages/mcp/src/confirmation-token.ts` documents it: a deterministic HMAC over tool and arguments, with no nonce store, so a token for a given action always validates. Bounded in practice — a replayed delete hits `CONTEST_NOT_FOUND` — but true single-use remains future hardening. Recorded in [`docs/threat-model.md`](threat-model.md) §3.9.

### There is no alerting

Security events and the audit log are recorded but nothing watches them; the design's "alert on >N failed logins" is unbuilt. Destructive actions are audited as domain events with actor and confirmation, but carry no source IP and sit outside the security-event stream. Recorded in [`docs/threat-model.md`](threat-model.md) §3.9.
