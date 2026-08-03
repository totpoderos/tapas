## Why

A Spanish-speaking host who tries to publish an incomplete contest reads this:

> Este concurso aún no puede ponerse en curso: **This contest cannot be published yet — it does not say what kind of contest it is.**

The frame is translated; the reason is not. `draft-workspace.tsx` renders `t('reviewDraft.publishError', { reason })` where `reason` is `ApiError.message` — the string the domain wrote, in English, always. Every one of the ten ways a publish can be refused arrives that way, and so does every refusal the assistant reports in the chat panel.

The `internationalization` capability already requires this: both frontends SHALL present all of their own interface text, "labels, buttons, headings, helper and **validation messages**", in either language. A publish refusal is a validation message. This is a gap in conformance, not a new promise — and it is the one place a host is most likely to be reading carefully, because something they wanted to happen did not.

Found while translating the new `DUPLICATE_CATEGORY_ID` refusal (PR #191) and deliberately not fixed there: adding an i18n path for one code would have made it the odd one out among ten. This does all ten at once, which is what that decision deferred to.

## What Changes

- **A refusal carries its facts, not only its sentence.** `CompileError` and `PublishError` gain `details` — the values already embedded in the English message (the people named, the categories named, the bounds, the things still unsaid). The message stays exactly as it is: it is what an MCP client, a log line, and any surface without translations still read.
- **The panel says it in the host's language**, on both surfaces that show one — the rules form and the chat panel — following the pattern the chat panel already uses for outstanding gaps: a key per code, values interpolated, and **an unrecognised code falling back to the API's sentence** rather than putting a raw key on screen.
- **The data inside a refusal stays as it is.** "Taste", "Originality", "Ana" are contest data, which `internationalization` says is left alone. Only the sentence around them is translated.
- **A refusal stops naming an internal id.** `DUPLICATE_PERSON_ID` reads `Duplicate participant id "p3f7a"` — an id the host has never been shown, for the same defect whose category twin was deliberately written to name the two categories instead. It becomes the two people's display names. In scope because this change rewrites that sentence anyway, and translating a leak would only translate it.

Not included, deliberately: refusals from anywhere but publishing. Sign-in, enrollment, scoring and the rest have the same shape of gap, and doing them here would make this change a survey rather than a fix. The mechanism this adds is what they would each reuse.

## Capabilities

### New Capabilities

<!-- None. -->

### Modified Capabilities

- `internationalization`: text the API writes **for a host to read** is interface text and SHALL be presented in the host's language; the contest data such text names — people, categories, contest names — SHALL be left as it is. The capability currently draws the line between interface text and data, but puts everything arriving from the API on the data side by implication, which is what left refusals in English.
- `validate-and-publish-contest`: a refusal SHALL carry the facts it is about in a form a caller can act on, not only an English sentence; and SHALL NOT name an internal id.

## Impact

- `packages/domain` — `CompileError`/`PublishError` gain an optional `details`; each `fail(...)` site fills it with what its message already interpolates. `DUPLICATE_PERSON_ID` reports display names instead of an id. Pure, no I/O.
- `packages/api` — the error body carries `details` alongside `code` and `message`. The publish routes already send `{ error }` wholesale, so this is mostly a type widening; the assistant's `refusalMessage` path needs the details carried through the turn.
- `packages/host-web` — one helper mapping code + details to a translated sentence, used by both `draft-workspace.tsx` and `chat.tsx`; `ApiError` gains `details`. Ten keys per language, EN and ES.
- `packages/mcp` — nothing. An MCP client is not a host reading a screen, and the English sentence is what it should keep getting.
- Tests — domain unit tests per code for the details; a component test per surface; and the existing `translations-say-the-same-things` guard already holds EN and ES to the same key set.
