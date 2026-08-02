Five sub-slices, each its own ATDD loop and its own PR. The acceptance
`.feature` for a slice is written and confirmed before its implementation
starts. Every slice ends on the full local gate — unit, whole vitest run,
typecheck, lint, `openspec validate --strict`, and the E2E suite — since CI is
off.

## 1. Slice A — every contest is addressed by its name

Taken first: it touches the most existing tools, and its tests protect every
slice after it.

- [x] 1.1 Write the acceptance feature for addressing by name — one match acts, several return the candidates, none reports nothing found, case-insensitive, another host's contest is never reached — and confirm it before implementing
- [x] 1.2 Extract the name→contest resolution the by-name routes already do into one shared use case in `packages/api`, with its own unit tests for the three-way answer
- [x] 1.3 Give the host-facing contest routes a by-name form (read, tally, results, close, publish, reveal, delete, rename), each answering result / candidates / nothing-found through the shared resolver
- [x] 1.4 Change the nine tools in `tool-catalog.ts` from `contestId`/`draftId` to `name`, and rename `update_draft` to `rename_contest`; delete the id-addressed forms rather than keeping them alongside
- [x] 1.5 Update the MCP contract tests and the in-app assistant's dispatch tests together, asserting both paths carry the same arguments to the same request
- [x] 1.6 Update `keyword-stub-llm-client.ts` so the deterministic E2E stub calls the by-name tools, and green the chat-panel E2E
- [x] 1.7 Full local gate, then PR

Two things Slice A turned up that were not foreseen:

- The panel would have reported a not-done action as done. `chat.tsx` keyed its
  rendering off tool names, so a `candidates` answer to a close fell through to
  the "done" ticket. Guarded here — a result carrying `candidates` is never
  reported as a change — rather than left for Slice B, because shipping A alone
  would otherwise tell a host their contest was closed when it was not.
- A destructive action is challenged for confirmation **before** its name is
  resolved, so a host can be asked to confirm closing a name two contests share
  and only then be told to choose. Nothing acts on the wrong contest (the
  confirmed call answers with the candidates and changes nothing), so this is a
  question asked too early rather than a wrong action. Left as is; see the
  follow-up below.

## 1b. Follow-up raised by Slice A — resolve before challenging

Not scheduled: needs a decision, since it changes the confirmation flow's shape.

- [x] 1b.1 **Settled: the name is resolved before the challenge.** A destructive
      tool now asks the API whether its contest name is one contest before the
      host is asked to approve anything, on both paths, through one shared pair
      of helpers in the catalogue (`resolutionRequestFor` / `readResolution`).
      The question is asked the way that tool addresses a contest — `addresses:
      'draft'` for the operations only a draft accepts — so the settling and the
      doing cannot disagree.

      **Not done: binding the resolved contest into the confirmation.** That
      would send the confirmed call to a different route than the unconfirmed
      one and put internal ids back into a protocol Slice A spent its whole
      length taking them out of. The residual is narrow and deliberate: between
      being challenged and confirming, a host could rename that contest and
      create another with the same name, and the confirmed action would land on
      the new one. It takes deliberate action mid-confirmation, and nothing acts
      on more than one contest either way.

## 2. Slice B — the panel renders by result shape

Before the new tools land, so they need no panel change when they do.

- [x] 2.1 Write the acceptance feature for the panel offering the choice when a name is shared, and saying plainly when a name matches nothing, for an action rather than only a read — confirm before implementing
- [x] 2.2 Replace `CONTEST_LIST_ACTIONS` / `DETAILS_ACTIONS` in `chat.tsx` with discrimination on the result's own shape, each shape keyed on a field only it has
- [x] 2.3 Widen the "which one did you mean?" path so any action can ask it, not only the three that can today
- [x] 2.4 Component tests for each shape, including an unfamiliar shape falling back to the plain ticket
- [x] 2.5 Add the i18n keys for the new wording to EN and ES, and grep every consumer of any key removed
- [x] 2.6 Full local gate, then PR

What Slice B turned up:

- **Asking "which one?" was a question the host could not answer.** Looking at
  the screen by hand — which the tests could not do — showed two candidates both
  reading "Tapas Night — Live", identical and unchoosable. Each candidate now
  carries what tells it apart: the join code the host already has on screen, or
  when it last changed for a draft that has none. The recap the model keeps
  carries it too, or the assistant cannot act on the answer it just asked for.
- **One action-name table survives, deliberately.** `DRAFT_ONLY_ACTIONS` decides
  whether an empty answer reads "no contest" or "no draft" — a noun, not a
  renderer. The shape of an answer genuinely cannot say which was asked for, and
  a tool missing from the table still gets a truthful message.

## 3. Slice C — a draft's scoring is settled by asking

- [x] 3.1 Write the acceptance feature for adding a category, removing one behind a confirmation, setting a fixed range, letting the range be worked out, and settling whether a score may be repeated — confirm before implementing
- [x] 3.2 One use case per operation in `packages/api` (`add-scoring-category`, `remove-scoring-category`, `set-score-range`, `set-score-uniqueness`), each loading the draft, applying one change, saving — with unit tests asserting no other rule moves
- [x] 3.3 ~~Refuse a rule that cannot stand~~ — **rescoped, see below**. Refuse a category name the draft already carries, and a removal of one it does not; a published contest answers "no draft found" like any other name that is not a draft
- [x] 3.4 Routes for each, addressed by contest name through the shared resolver
- [x] 3.5 Add the four tools to `tool-catalog.ts`, `remove_category` marked destructive so it takes the existing confirmation flow
- [x] 3.6 Full local gate, then PR

**3.3 was written against the wrong rule.** It asked for "a range whose bounds
make no range" to be refused at edit time. But `editing-a-contest-draft.feature`
already states this repo's line: a draft need not be valid to be saved, and the
rules are checked at publish. The existing specs draw it precisely — a *shape*
error (a format outside the three) is refused at edit; a *coherence* error is
the compiler's at publish. A 5..2 range is two good numbers in a good shape, so
refusing it here would be a second validator the form does not share — the
parallel-path divergence this repo keeps paying for. It is stored, and a
scenario pins that publishing refuses it, so nobody "fixes" this later without
meeting the reasoning.

The one refusal that *was* added stands on different ground: a category name the
draft already carries is refused because the assistant addresses a category **by
name**, so two called "Taste" would leave the host unable to say which to
remove. That is addressing, not validation. The form can allow duplicates
because it removes by the row it drew.

What Slice C turned up:

- **The MCP path dropped every refusal reason.** `describeFailure` surfaced only
  the error *code*, so an external assistant could report that something failed
  but never what to do about it — while the in-app assistant showed the host-
  facing sentence the API had written (`refusalMessage`). One failure, two paths,
  two answers. Fixed here; the reason now reaches both.
- **A removal that matches nothing is refused, not quietly reported as done.**
  `remove_participant` still no-ops silently in that case, which is now
  inconsistent. Left alone rather than changed under cover of this slice — see
  the follow-up below.

## 3b. Follow-up raised by Slice C

- [x] 3b.1 **Settled: it refuses, as `remove_category` does.** And writing the
      spec for it turned up something worse than the logged complaint:
      `remove_participant` collected **every** participant matching the display
      name, so a host with two people called "Ana" who confirmed "remove Ana"
      lost **both**. A destructive action taking away more than the host named
      is the one thing confirming exists to prevent, and the confirmation they
      gave named one person. A shared name now goes back to the host, exactly as
      `set_partner` does with one.

## 4. Slice D — a draft's format and partners are settled by asking

- [x] 4.1 Write the acceptance feature for setting the format, pairing two people, and leaving someone without a partner — confirm before implementing
- [x] 4.2 ~~`set-format`, refusing a format a draft's people cannot satisfy~~ — **rescoped, same reason as 3.3**: `UNKNOWN_FORMAT` (a format outside the three) is a shape error the domain already refuses wherever a draft is written; `UNPARTNERED_IN_COUPLES` is coherence, and couples-while-unpaired is an ordinary halfway state a host passes through in the panel too. Settled, with a scenario pinning that publishing refuses it
- [x] 4.3 `set-partner` use case: names two people by display name, pairs them both ways, and frees whoever either of them leaves — with unit tests for the one-sided-partnership case the compiler would otherwise reject at publish
- [x] 4.4 Resolve a person by display name within the draft with the same three-way answer as a contest name, including the ambiguous-display-name case
- [x] 4.5 Routes and the two tools, addressed by contest name
- [x] 4.6 Full local gate, then PR

The refusals this slice does carry are all about **addressing**, not validation,
exactly as Slice C's duplicate category was: a name nobody taking part has, a
name two of them share, and a person named as their own partner. Each is a name
that fails to address one person, which is the assistant's only way to reach
them.

The one thing here that is neither addressing nor validation: a partnership is
set on **both** people at once, and whoever either of them leaves is freed. That
is the half a host never says out loud, and getting it wrong leaves the draft
holding a one-sided partnership that publishing rejects as not reciprocal — with
a reason the host cannot connect to anything they asked for.

**A pairing was invisible.** The details view every draft edit answers with
carried participants and categories and nothing about who was paired, so
`set_partner` reported exactly what it would have reported before the host asked
— the change could not be seen by the one person who wanted it. Details now
carry the pairs, each named once, and the panel shows them.

Fixing it turned up four copies of the same details builder — one per group of
draft edits, plus the details read. `pairs` is precisely the field that would
have been added to one and forgotten in the others, so they are now one
`draftDetailsOf`.

## 5. Slice E — the assistant is measured on the wider surface

- [x] 5.1 Extend the host-assistant eval cases to cover each new operation and the by-name addressing ~~including a case where a name is shared and the right move is to ask~~ — **rescoped, see below**
- [x] 5.2 Run the eval gate against the configured hosted model and record the trajectory
- [x] 5.3 Decide the threshold from what it actually scores, and commit it
- [x] 5.4 Update the eval docs and the README for a hosted model
- [x] 5.5 Full local gate, then PR

**5.1 asked for something the eval cannot express.** The eval scores the proposed
tool call and has no notion of the host's contest inventory. The model cannot
know a name is shared — and should not: it proposes the call, and the server
resolves and asks, which is what the confirmation-ordering follow-up built. What
*is* measurable about by-name addressing is that the model puts a **name** in
`contest` and never anything id-shaped, so the case became
`destructive-close-names-not-codes`: the host's message carries a join code and
the expected call still carries the name.

That is the third task in this change whose premise did not survive contact with
the design — 3.3, 4.2 and now 5.1. In each case the plan was written before the
code was read.

**The case set was blind.** It measured 9 of 21 tools; every draft edit from
Slices C and D was covered by nothing at all, and no test failed to say so. Now
50 cases, with a guard that every tool in the list appears in at least one case.

**Two of my own cases were defective**, both found by the first run and fixed
before the recorded one: an adversarial case pinned partial arguments where the
metric deep-equals the whole object (the model had behaved perfectly), and a
multi-tool case was ambiguous between two defensible reads. Both runs are
recorded in the trajectory rather than only the flattering one.

**Thresholds were raised wholesale**, from floors calibrated to a small local
model that could no longer fail. Set from a single run, and said to be a
hypothesis rather than a measurement.

## 6. Close out

- [ ] 6.1 `openspec sync` the delta specs into `openspec/specs/`, then archive the change
- [ ] 6.2 Re-check the `openspec/specs/` record reads as the built system, not as the plan
