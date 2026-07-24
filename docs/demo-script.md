# Defense demo — 15 minutes

*Task 6.8. A **runnable** script for the thesis defense: exact commands, exact
clicks, what to say, and what to do when something misbehaves. Everything here
demos code that actually exists — nothing aspirational.*

**The argument in one sentence:** *one API is the single authority on
authorization; AI can reach it three different ways; every action lands in one
audit log; and nothing destructive happens without a human saying yes.*

---

## Pre-flight (do this before the room fills)

```bash
git pull && npm install
npm test                 # 935 green — leave the output on screen
```

Then open **four** things and leave them ready:

| # | What | How |
|---|---|---|
| 1 | Terminal A — the stack | `ASSISTANT_STUB=1 npm run dev` |
| 2 | Terminal B — for tests/evals | (empty prompt in the repo) |
| 3 | Host app | http://localhost:5173 — **already signed in** |
| 4 | Participant app | http://localhost:5174 — in a **second browser profile** (or private window), so the two cookie sessions don't collide |

> **Why `ASSISTANT_STUB=1`.** The demo's chat beats must work on the first try in
> front of an examiner. The stub maps two typed phrases to real tool calls and
> then runs the **entire real pipeline** — same routes, same HMAC gate, same audit
> log. The model's *actual* behaviour is not hand-waved: it is measured honestly in
> the eval (segment 4), which is the right place for it. Say this out loud — it is
> a methodological point in your favour, not an apology.
>
> If you prefer a live model: start Ollama, drop `ASSISTANT_STUB=1`, and phrase
> requests plainly. Have the stub as a fallback.

**Stub trigger phrases** (exact):
- `start a draft called Tapas Night` → `create_draft` *(reversible — runs immediately)*
- `close <contest-id>` → `close_contest` *(destructive — held for confirmation)*

Pre-create **one published, live contest** with 2–3 participants and at least one
submitted dish, so segment 5 has something real to close and reveal. Keep its
**join code** and **contest id** on a sticky note.

---

## The 15 minutes

### 0 · Framing — 1 min

> "Tapas runs real tapas contests. But the thesis question isn't *can an LLM fill
> a form* — it's **how do you let AI act on a real system safely**. Three things
> carry that: one authorization authority, evaluated AI surfaces, and an audit
> trail that covers every path including the AI's."

Show [`docs/architecture.md`](architecture.md) diagram 1 (system context) for ~15
seconds. Point at the trust boundary. Move on — don't narrate all seven.

---

### 1 · The domain is compiled, not interpreted — 2 min

> "A contest isn't one product. It's a point in a five-dimensional rule space:
> attribution, anti-bias, scoring range, uniqueness, categories. On **publish**,
> those choices are *compiled* — a pure function, no I/O, no LLM — into a
> materialized constraint view the runtime enforces."

**Terminal B:**

```bash
npx vitest run packages/domain
```

> "Zero I/O in the domain package — lint-enforced — so the compiler is testable as
> a pure function, including property-based tests. This is why the rule language is
> never re-interpreted at request time."

**Payoff to state now (you'll show it in segment 3):** the participant's score
screen is *generated from the compiled rules*, so an invalid score is impossible
to enter — not validated after the fact, **impossible by construction**.

---

### 2 · Both creation paths — 3 min

**Path A — the form.** Host app → **New contest** (`/new`). Fill a name, pick
attribution, add a scoring category, add 2–3 participants → **Save**.

> "Standard path. Validated, ownership-scoped, and it lands in the audit log as
> `sourcePath: form`."

**Path B — the chat.** Host app → **Assistant** (`/chat`). Type:

```
start a draft called Tapas Night
```

A green result ticket appears.

> "Same outcome, different entry point. And critically — the assistant did **not**
> get its own database access. It proposed a tool; the API dispatched that tool
> **back through its own routes**, carrying my session cookie. Ownership, validation
> and auditing are enforced exactly once, in one place."

Show [`docs/architecture.md`](architecture.md) diagram 2 (three entry points) for
a beat.

**The injection defense (say it, ~20 s — it's a strong point):**

> "Participant names are attacker-controlled text that goes into an LLM prompt. A
> convincing name can fool the model into reporting a high-stakes rule as
> *host-stated*. So there's a deterministic guard that reads the names directly —
> not the model's own claim about them — and drops any high-stakes rule a name
> tries to dictate, surfacing it as a clarification instead. The eval measures
> exactly this: false-field rate is **0.0%**."

---

### 3 · The participant journey — 2 min

Participant window → enter the **join code** → pick a name → **submit a dish** →
**Score the dishes**.

> "Mobile-first, because this is used standing up at a venue in bad light."

Point at the score inputs:

> "This screen is **generated from the compiled rules**. In this contest repeats
> are allowed, so it's a rating: only the values in range are offered. In a
> *unique-per-category* contest the same screen becomes a **ranking** — choosing a
> rank another dish holds swaps them, so the ranks stay a permutation. An invalid
> score isn't rejected; it's **unreachable**. And the backend still independently
> rejects a bad vote — defense in depth."

Send the vote.

---

### 4 · The AI is measured, not trusted — 3 min

> "Two of the three AI surfaces have frozen eval sets with committed thresholds."

Open [`docs/eval-trajectory.md`](eval-trajectory.md) and show the trajectory table:

| Prompt | Schema validity | Field accuracy | Recall | False-field |
|---|---|---|---|---|
| v1 baseline | 34.5 | 84.3 | 90.9 | 0.0 |
| **v2 (adopted)** | **89.7** | 88.2 | 84.1 | 0.0 |
| v3 (reverted) | 58.6 | 83.9 | 88.6 | 0.0 |

The three things to say — **v3 is the most interesting**:

1. "The bottleneck was **shape, not answers** — accuracy was already 84%, but the
   model kept malforming nested objects. v2 added the exact shapes: **34.5 → 89.7**."
2. "**v3 I tried and reverted.** Adding a 'you must always ask' imperative bought
   +4.5 points of recall and **cost 31 points of schema validity**. On a small
   model, more instruction text is not free — it crowded out the shape adherence
   v2 had won. I kept it in the trajectory as a **recorded negative result**."
3. "False-field rate is **0.0** throughout — that's the injection-defense metric."

**Terminal B — show the gate is real, not decorative:**

```bash
npm run eval:gate -- --suite creation --report <a passing report>
```

> "Deterministic tests hard-gate the build. Evals are threshold-gated on a
> separate track, because a real model's output isn't mine to make deterministic.
> A metric below its committed floor exits non-zero and blocks."

---

### 5 · The centrepiece — destructive actions need a human — 3 min

Host app → **Assistant** (`/chat`). Type (using the real contest id):

```
close <contest-id>
```

**A confirmation card appears. Stop here and let it sit.**

> "The model proposed closing a live contest. Nothing happened. What came back
> isn't the action — it's a **proposal plus a confirmation token**, which is an
> **HMAC over the tool name and its exact arguments**. Three things follow:
> a token minted to close contest A **cannot** close contest B; the confirm leg
> runs **no model at all** — it validates the token and dispatches; and the same
> gate exists on the MCP path, so an external client gets `confirmationRequired`
> too. It's a property of the system, not of this screen."

Press **Escape**.

> "Cancelled. Nothing ran — the contest is still live."

Now do it again and press **Yes**.

> "Now it's closed. And note the accessibility work is the same work: the card is
> `role="alertdialog"`, focus opens on the **safe** default, Tab is trapped, Escape
> cancels."

Then trigger the **reveal** from the host control room (`/contest/:id`) — and
point at the participant window:

> "The waiting participant sees the results appear **without reloading**."

*(If the stub misfires: do the same close/reveal from the control room, where each
irreversible action goes through the same focus-trapped confirmation. The
mechanism is identical — only the entry point differs.)*

---

### 6 · One audit log — 1.5 min

Host app → the contest → **Activity log** (`/log/:id`).

> "Every action from every path, in one log — because it's a **projection of domain
> events**: the domain emits pure events, the application layer enriches them with
> request-path metadata the domain can't know."

Point at the columns:

- **`sourcePath`** — `form` · `mcp` · `system` are all first-class
- **`confirmation`** — `host` vs `auto` on destructive actions
- the **"✓ You confirmed"** badge on the close you just did

> "So the question *'who did this, through which path, and did a human approve
> it?'* is answerable for every action — **including the ones an AI proposed**."

---

### 7 · Security and infrastructure as artifacts — 1.5 min

Open [`docs/threat-model.md`](threat-model.md) — show the OWASP 2025 mapping table,
then **scroll to the gaps table**:

> "Mapped to the OWASP Top 10, with code references. But the part I'd point at is
> **section 4 — what it does *not* defend against**. I wrote this from the code, not
> from my design document, and that comparison found real drift: the design claimed
> an `admin` role and `requireRole()` that were **never built**, and it found two
> HIGH secret-handling holes — including a committed default that keyed the
> destructive-action HMAC. Both are fixed; the rest are triaged with a rationale."

**Terminal B:**

```bash
npm run audit:ci
```

> "Supply-chain gate. It blocks on high/critical advisories — and mid-project it
> caught a live React Router CVE. The allowlist entries are justified **and expire**,
> so a stale exception re-blocks instead of rotting."

Close on [`docs/infra-generation.md`](infra-generation.md):

> "Third AI surface: the Dockerfiles, compose, CI and CD were AI-generated — and
> *verified*, with every bug the verification caught written down."

---

### Close — 30 s

> "One API as the only authorization authority. Three entry points that all
> converge on it. Every action in one audit log. Nothing destructive without a
> human. And the AI surfaces are measured, with the negative results kept."

---

## Timing

| Segment | Min | Running |
|---|---|---|
| 0 Framing | 1.0 | 1.0 |
| 1 Compiled domain | 2.0 | 3.0 |
| 2 Both creation paths | 3.0 | 6.0 |
| 3 Participant journey | 2.0 | 8.0 |
| 4 Evals + trajectory | 3.0 | 11.0 |
| 5 Destructive confirmation | 3.0 | 14.0 |
| 6 Audit log | 1.5 | 15.5 |
| 7 Security + infra | 1.5 | 17.0 |
| Close | 0.5 | 17.5 |

**Over budget by design.** If you must hit 15 exactly, cut **segment 1** to 45 s
(state the compiler claim, skip the test run) and **segment 3** to 1 min (skip the
dish, go straight to scoring). Never cut 5 or 6 — they *are* the thesis.

---

## If something breaks

| Symptom | Do this |
|---|---|
| Chat returns a plain reply, no tool | The stub phrase must match — `start a draft called X` / `close <id>`. Check `ASSISTANT_STUB=1` is set. |
| Confirmation card doesn't appear | You used a *reversible* tool. Only `close_contest`, `publish_contest`, `trigger_reveal` are destructive. |
| Participant can't join | Contest must be **live** (published, not closed). Re-check the join code. |
| Cookie/session weirdness | The two apps must be in **separate browser profiles** — same-origin proxies keep each cookie first-party. |
| Contest auto-closed early | Default `closeRule` is `all_sent` — with one voter it closes on send. Seed with `host_trigger` for the demo. |
| Anything unrecoverable | Fall back to the **E2E**: `npm run test:e2e` drives this exact journey headless, including the host-reveals-participant-sees beat. |

---

## Questions you should expect

**"Isn't the stub cheating?"**
> "The stub replaces only *model choice*; everything after it — the HMAC gate,
> ownership, dispatch, audit — is the real path. Model choice is measured in the
> eval instead, on a frozen 25-case set, where I also report where it does badly:
> 64.7% tool selection, and chaining at 25%."

**"What if the model is convinced to skip confirmation?"**
> "It can't. The model never holds a valid token — the server mints one, bound to
> the exact tool and arguments, and the confirm leg runs no model. The worst a
> compromised model does is *propose* something the human then declines."

**"Why SQLite?"**
> "It's Postgres-ready — migrations, no SQLite-only SQL. For one contest at one
> venue, an embedded DB is the honest choice. The tradeoff is written down."

**"What's weakest?"**
> Answer straight — it lands better than deflecting: "No alerting on the security
> events; the audit log is append-only but not signed; the `admin` role was never
> built; and confirmation tokens are replayable for the *same* action. All four are
> in section 4 of the threat model with a disposition."
