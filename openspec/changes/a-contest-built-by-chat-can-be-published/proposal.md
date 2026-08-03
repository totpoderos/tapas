# A contest built by chat can be published

## Why

A host set up a whole contest in one message — name, two categories, three
people, a score range, duplicate scores allowed — and could not publish it.
Publishing refused: "it does not say what kind of contest it is." The only way
out was to leave the chat, open the contest for review, press Save changes, and
publish from there.

Nothing failed. The host never said what kind of contest it was, so the
assistant never set it — correctly, because guessing a rule the host did not
state is exactly what this app refuses to do. The gap is that nothing ever asked
them, and nothing told them a draft was one answer short of ready. The review
form does not have this problem for the opposite reason: its "what kind of
contest is this?" fieldset opens with a choice pre-selected, so pressing Save
writes one whether or not the host looked at it. One path asks a question the
host cannot miss; the other never raises it.

The result is a chat that can build everything about a contest except the one
thing that lets it start.

## What Changes

- The assistant, having carried out everything a message asked for, **asks for
  what the draft still needs** before it can be published — naming the choices
  in plain words rather than restating that something is absent.
- A draft **says what it still needs** to be published, as part of its details,
  wherever those details are read — not only at the moment publishing is
  refused.
- The panel **shows what is still needed** on a draft the assistant just
  changed, so a host reads the gap when they can still act on it.
- No default is invented. The format, the scoring and the participants stay the
  host's to state, as they already are for the draft extracted from a
  description.

## Capabilities

### New Capabilities

None. This closes a gap in behaviour two existing capabilities already claim.

### Modified Capabilities

- `converse-with-the-host-assistant` — the assistant asks for what a draft still
  needs, and the panel shows it after a change.
- `contest-management-api` — a draft's details carry what it still needs before
  it can be published.

## Impact

- `packages/domain` — what a draft still needs becomes a named thing the domain
  answers, rather than a sentence private to publishing.
- `packages/api` — draft details carry it; the assistant's system prompt asks
  for it.
- `packages/host-web` — the chat panel shows it on a draft ticket.
- `packages/evals` — a case covering a setup message that leaves the format
  unsaid.
- No change to the rule compiler, to publishing's own checks, or to any stored
  data.
