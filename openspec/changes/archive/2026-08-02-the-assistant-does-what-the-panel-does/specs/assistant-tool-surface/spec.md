## ADDED Requirements

### Requirement: The assistant addresses every contest by its name

A host SHALL be able to name the contest they mean for every action the
assistant can take, and SHALL never have to quote an internal id. This holds for
the whole surface — reading a contest, reading a draft, reading a tally, reading
results, renaming, publishing, closing, revealing, deleting, and every edit to a
draft's rules — not merely for the few actions that accept a name today.

Because a host may reuse a name, a name SHALL resolve the same way everywhere:
when exactly one of the host's contests bears the name, the action is carried
out on it; when several do, nothing SHALL be changed and the candidates SHALL be
returned so the assistant can ask the host which one is meant; when none does,
nothing SHALL be changed and the answer SHALL say so. A name SHALL match exactly
but without regard to case. Only the host's own contests are ever considered.

An ambiguous name SHALL change nothing at any step — neither on the request that
names it nor on a confirmation carrying it — so a request the host has not yet
settled cannot take effect on the wrong contest.

A name SHALL be settled before the host is asked to approve anything. A
destructive action on a name that is not one contest SHALL come back as the
candidates to choose from rather than as a confirmation to give: a host cannot
meaningfully approve an action that is not yet one action.

#### Scenario: An action names the contest it acts on

- **WHEN** a host asks a connected assistant to act on one of their contests by its name
- **THEN** the action is carried out on that contest

#### Scenario: A name several contests share changes nothing and offers the choice

- **WHEN** a host asks a connected assistant to act on a name two of their contests share
- **THEN** neither contest is changed
- **AND** both are offered to choose from

#### Scenario: A name no contest has changes nothing

- **WHEN** a host asks a connected assistant to act on a name none of their contests has
- **THEN** nothing is changed
- **AND** the answer says no contest has that name

#### Scenario: A name matches without regard to case

- **WHEN** a host names one of their contests to a connected assistant in a different case from how it was saved
- **THEN** the action is carried out on that contest

#### Scenario: Another host's contest is never reached by name

- **WHEN** a host asks a connected assistant to act on a name only another host's contest has
- **THEN** nothing is changed
- **AND** the answer says no contest has that name

### Requirement: A host can shape a draft's rules through a connected assistant

A host SHALL be able to settle, by asking, every rule of a contest they are
preparing that they could settle in the panel: what kind of contest it is, what
it is judged on, how it is scored, and who is paired with whom. Each is a
separate action naming the draft it changes, so a host can change one thing
without restating the rest, and no unmentioned rule is ever disturbed.

This is for drafts only. A published contest's rules are settled, and an attempt
to change one SHALL be refused and change nothing.

Setting a rule is an ordinary reversible edit and SHALL happen directly.
Removing something a host has already named — a scoring category — takes work
away, so it SHALL be treated as destructive and SHALL NOT be carried out until
the host confirms, exactly as removing a person is.

The assistant decides nothing itself: what makes a coherent set of rules is
judged where it is judged for the panel, and a rule that cannot stand SHALL be
refused with a reason a host can act on.

#### Scenario: The assistant sets what kind of contest a draft is

- **WHEN** a host asks a connected assistant to make one of their drafts a couples contest, naming the draft
- **THEN** that draft is a couples contest

#### Scenario: The assistant adds something for a draft to be judged on

- **WHEN** a host asks a connected assistant to add a scoring category to one of their drafts, naming the draft
- **THEN** that draft is judged on that category as well as the ones it had

#### Scenario: Removing a scoring category is not carried out until the host confirms

- **WHEN** a host asks a connected assistant to remove a scoring category from one of their drafts without a confirmation
- **THEN** the draft is still judged on that category
- **AND** the assistant is told the action needs confirming

#### Scenario: The assistant removes a scoring category once the host confirms

- **WHEN** a host asks a connected assistant to remove a scoring category from one of their drafts with a valid confirmation
- **THEN** that draft is no longer judged on that category

#### Scenario: The assistant sets the range scores are given within

- **WHEN** a host asks a connected assistant to score one of their drafts between two given numbers, naming the draft
- **THEN** that draft is scored within that range

#### Scenario: The assistant lets the range be worked out from the contest

- **WHEN** a host asks a connected assistant to let one of their drafts work its own range out, naming the draft
- **THEN** that draft's range is worked out from the contest rather than fixed

#### Scenario: The assistant settles whether a score may be repeated

- **WHEN** a host asks a connected assistant that each score be used only once per category in one of their drafts
- **THEN** that draft requires a different score for each dish in a category

#### Scenario: The assistant pairs two people as partners

- **WHEN** a host asks a connected assistant to pair two of the people in one of their drafts, naming the draft
- **THEN** those two are partners in that draft
- **AND** neither is partnered with anyone else

#### Scenario: The assistant parts two people who were partners

- **WHEN** a host asks a connected assistant to leave one of the people in one of their drafts without a partner
- **THEN** that person has no partner in that draft
- **AND** the person they were partnered with has none either

#### Scenario: A published contest's rules cannot be changed

- **WHEN** a host asks a connected assistant to change a rule of one of their published contests
- **THEN** the request is refused
- **AND** the contest is unchanged

#### Scenario: A rule that cannot stand is refused with a reason

- **WHEN** a host asks a connected assistant to score one of their drafts between two numbers that cannot make a range
- **THEN** the request is refused with a reason the host can act on
- **AND** the draft is unchanged

#### Scenario: Changing one rule leaves the others alone

- **WHEN** a host asks a connected assistant to change one rule of a draft that already has a format, categories and people
- **THEN** only that rule is different
- **AND** the draft's other rules and its people are as they were

## MODIFIED Requirements

### Requirement: A host can read their drafts and live tallies through a connected assistant

Beyond a published contest, a host SHALL be able to have their connected
assistant read the other things that belong to them: a contest draft they are
preparing, and the live tally of a running contest (how many participants have
claimed a place, are still scoring, and have sent their votes). Both SHALL be
asked for by the contest's name, resolved as every name is. The same rule holds
as for every tool — the assistant acts strictly as that host, reading only what
the host owns, and deciding nothing itself.

#### Scenario: The assistant reads a draft the host owns

- **WHEN** a host asks a connected assistant to read one of their own drafts by its name, using their personal access token
- **THEN** the draft is returned

#### Scenario: The assistant reads the live tally of the host's contest

- **WHEN** a host asks a connected assistant to read the tally of one of their own running contests by its name, using their personal access token
- **THEN** the tally is returned

#### Scenario: The assistant cannot read a draft the host does not own

- **WHEN** a host asks a connected assistant to read a draft owned by a different host, using their own token
- **THEN** no draft is found

### Requirement: A host can author and publish a contest through a connected assistant

A host SHALL be able to build a contest through the assistant: create a draft,
refine it, and publish it into a live contest. Creating and refining a draft are
ordinary reversible edits and SHALL happen directly. Publishing SHALL be treated
as a destructive action — a live contest cannot be un-published — and so SHALL
require the same confirmation as any other destructive action. The draft to
rename or publish SHALL be named, not quoted by id.

#### Scenario: The assistant creates a draft for the host

- **WHEN** the assistant is asked to create a draft with a given name for the host
- **THEN** a draft with that name is saved for the host

#### Scenario: The assistant renames a draft

- **WHEN** the assistant renames one of the host's drafts, naming the draft
- **THEN** the draft's name is changed

#### Scenario: Publishing a draft must be confirmed

- **WHEN** the assistant is asked to publish one of the host's drafts, naming it, without a confirmation
- **THEN** the draft is not published
- **AND** the assistant is told the action needs confirming

#### Scenario: A confirmed publish creates a live contest

- **WHEN** the assistant publishes the draft with the confirmation it was given
- **THEN** the contest is live

### Requirement: A host can reveal a contest and read its results through a connected assistant

A host SHALL be able to reveal a closed contest and read its results through the
assistant, naming the contest in both cases. Revealing announces the winners and
cannot be undone, so it SHALL be treated as a destructive action requiring
confirmation; reading the results is an ordinary read that SHALL return the
category totals and winners of a revealed contest.

#### Scenario: Revealing a contest must be confirmed

- **WHEN** the assistant is asked to reveal one of the host's closed contests by name without a confirmation
- **THEN** the contest is not revealed
- **AND** the assistant is told the action needs confirming

#### Scenario: A confirmed reveal reveals the contest

- **WHEN** the assistant reveals the closed contest with the confirmation it was given
- **THEN** the contest is revealed

#### Scenario: The assistant reads the results of a revealed contest

- **WHEN** the assistant is asked to read the results of one of the host's revealed contests by name
- **THEN** the results are returned

### Requirement: A host can read a contest through a connected assistant

A host SHALL be able to connect an assistant (or any external client) to their
account with a personal access token and have it read their contests on their
behalf, naming the contest they mean. The assistant SHALL act strictly as that
host: it may read only contests the host owns, and only while the token is
valid. The assistant makes no authorization decision of its own — it carries the
host's request and identity through, and the account's own ownership rules
govern what comes back (design.md §6.3). A contest the host owns is returned; a
contest owned by another host is not found, since only the host's own contests
are ever searched; without a valid token the request is refused as not
authorized.

#### Scenario: The assistant reads a contest the host owns

- **WHEN** a host asks a connected assistant to read one of their own contests by name, using their personal access token
- **THEN** the contest is returned

#### Scenario: The assistant cannot read a contest the host does not own

- **WHEN** a host asks a connected assistant to read a contest owned by a different host, using their own token
- **THEN** no contest is found

#### Scenario: Without a valid token the assistant cannot read a contest

- **WHEN** a connected assistant is asked to read a contest without a valid personal access token
- **THEN** the request is refused as not authorized
