## Context

Ten ways a publish can be refused, all written in the domain as English sentences:

| Code | What its sentence interpolates |
|---|---|
| `INCOMPLETE_DRAFT` | which of format / participants / scoring are unsaid, joined with "or" |
| `NO_PARTICIPANTS` | — |
| `NO_CATEGORIES` | — |
| `DUPLICATE_PERSON_ID` | **an internal id** |
| `DUPLICATE_CATEGORY_ID` | two category names |
| `MISSING_PARTNER` | one display name |
| `INCONSISTENT_PARTNER` | one display name |
| `UNPARTNERED_IN_COUPLES` | one display name |
| `INVALID_RANGE` | the two bounds |
| `JUDGE_CANNOT_SCORE_ANY_DISH` | one display name |

They reach a host through `t('reviewDraft.publishError', { reason: caught.message })` on the rules form and `t('chat.failed', { reason: turn.message })` in the chat panel. Both translate the frame and neither can translate the reason, because a sentence is not something a reader can re-language.

The precedent for the fix is already in this repo. `chat.tsx` takes the draft's outstanding gaps — `['format']`, not a sentence — and renders `t('chat.needs.format')`, joining several with `Intl.ListFormat` in the current language and **dropping an entry it has no wording for** rather than showing the key. That is the shape to follow; this change gives publish refusals the same raw material to work from.

## Goals / Non-Goals

**Goals:**

- A host reads why their contest could not go live, in their language, on both surfaces that tell them.
- The people and categories a refusal names are still named, exactly as the host wrote them.
- A surface with no translations — a connected assistant, a log — keeps the sentence it has today.
- No refusal shows an internal id.

**Non-Goals:**

- Refusals from anywhere but publishing. The same gap exists for sign-in, enrollment and scoring; this builds the mechanism they would reuse and stops there.
- Translating the domain. `packages/domain` has zero I/O dependencies and no business knowing what a locale is — it reports facts, and the frontends have the words.
- Translating contest data. `internationalization` is explicit that names are left alone, and a translated "Taste" would be a bug.
- A locale on the API. See below.

## Decisions

### The domain reports facts; the frontend has the words

`CompileError` and `PublishError` gain `details?: Readonly<Record<string, string | number | readonly string[]>>` — exactly the values the English sentence already interpolates, under names the translations use as interpolation keys.

*Why not translate on the server, from `Accept-Language`:* it would put a second copy of the vocabulary in the API, in a repo that keeps every translated string in the frontend that shows it and holds the two languages to the same key set with a test. Two homes for the same words is how they drift. It would also mean the API answering differently per caller, which is a worse thing to debug than a missing key.

*Why keep the message:* it is the whole of what an MCP client, a log line and an API consumer get. `refusalMessage` in the assistant turn already shows it to a host on purpose — "the API already writes these for hosts" — and removing it would break every one of those readers to serve one screen.

### The frontend maps code → key, and falls back to the sentence

One helper, used by both surfaces: given a code and its details, look up `reviewDraft.publishReason.<CODE>` and interpolate. An unrecognised code falls back to the sentence the API sent.

*Why fall back to the sentence rather than to a generic line:* the chat precedent drops what it cannot word because an unworded gap is one of three known things and the sentence reads fine without it. A refusal is different — dropping it would leave a host told only that something failed. The English sentence is worse than Spanish and much better than nothing, and it is exactly what they see today, so the fallback is the current behaviour rather than a new failure mode.

*Why not a translated generic line:* "This contest could not be published" for an unknown code hides a reason the API took trouble to write. A new refusal added to the domain and not yet worded should degrade to English, not to silence.

### `DUPLICATE_PERSON_ID` starts naming people

Its message quotes an internal id. Its category twin, written a few days ago, deliberately names the two categories because "a host looking at two differently-named things needs to know which two are the problem, and has never been shown an id". The person version predates that reasoning and contradicts it.

Folded in here rather than left: this change rewrites the sentence and adds its details, so the alternative is deliberately carrying the leak into two languages. The code name keeps `_ID` — it is the defect's name, and renaming it would touch every caller for no gain.

## Risks / Trade-offs

- **A new refusal added later, with no key, silently reads English.** → That is the fallback working, but nothing announces it. Mitigated by the existing `translations-say-the-same-things` test holding EN and ES to the same key set, which catches a key added to one language only — not a code added with no key at all. A test that the key set covers every `PublishErrorCode` closes that, and is cheap because the union is exhaustive in the type system.

- **`details` is a loose record, so a key can be renamed in the domain and quietly stop interpolating.** → i18next renders `{{person}}` literally when the value is missing, which is visible but ugly. The component tests assert the rendered sentence for each code, so a renamed key fails them.

- **The chat panel shows refusals for every tool, not just publishing.** → Only publish refusals gain details in this change, so the others keep falling back to the sentence — no regression, but the panel will be half-translated in a way that is not obvious from reading it. Worth a comment at the fallback saying which refusals have words and which do not, so the next person does not read it as a bug.

## Migration Plan

None. `details` is additive and optional; a caller that ignores it sees exactly what it sees today. No stored data carries a refusal.

## Open Questions

- `INCOMPLETE_DRAFT` needs its gaps joined into a list — "what kind of contest it is, or how it is scored". The chat panel already does this with `Intl.ListFormat` type `conjunction` ("and"); a refusal wants `disjunction` ("or"), because any one of them alone blocks the publish. Assumed `disjunction`, matching the English sentence's existing "or".
