## ADDED Requirements

### Requirement: A host can read a contest through a connected assistant
A host SHALL be able to connect an assistant (or any external client) to their
account with a personal access token and have it read their contests on their
behalf. The assistant SHALL act strictly as that host: it may read only contests
the host owns, and only while the token is valid. The assistant makes no
authorization decision of its own — it carries the host's request and identity
through, and the account's own ownership rules govern what comes back
(design.md §6.3). A contest the host owns is returned; a contest owned by another
host is refused as not allowed; without a valid token the request is refused as
not authorized.

#### Scenario: The assistant reads a contest the host owns
- **WHEN** a host asks a connected assistant to read one of their own contests, using their personal access token
- **THEN** the contest is returned

#### Scenario: The assistant cannot read a contest the host does not own
- **WHEN** a host asks a connected assistant to read a contest owned by a different host, using their own token
- **THEN** the request is refused as not allowed

#### Scenario: Without a valid token the assistant cannot read a contest
- **WHEN** a connected assistant is asked to read a contest without a valid personal access token
- **THEN** the request is refused as not authorized

### Requirement: A host can read their drafts and live tallies through a connected assistant
Beyond a published contest, a host SHALL be able to have their connected
assistant read the other things that belong to them: a contest draft they are
preparing, and the live tally of a running contest (how many participants have
claimed a place, are still scoring, and have sent their votes). The same rule
holds as for every tool — the assistant acts strictly as that host, reading only
what the host owns, and deciding nothing itself.

#### Scenario: The assistant reads a draft the host owns
- **WHEN** a host asks a connected assistant to read one of their own drafts, using their personal access token
- **THEN** the draft is returned

#### Scenario: The assistant reads the live tally of the host's contest
- **WHEN** a host asks a connected assistant to read the tally of one of their own running contests, using their personal access token
- **THEN** the tally is returned

#### Scenario: The assistant cannot read a draft the host does not own
- **WHEN** a host asks a connected assistant to read a draft owned by a different host, using their own token
- **THEN** the request is refused as not allowed

### Requirement: A destructive action must be confirmed before the assistant carries it out
The assistant SHALL require an explicit confirmation for a destructive action
(closing a contest, publishing, sending reminders) before carrying it out. A
first, unconfirmed request SHALL change nothing; instead the assistant SHALL be
given a confirmation for that exact action to present and send back, and only a
request carrying that confirmation SHALL carry the action out. A confirmation
SHALL be tied to the one action it was issued for and MUST NOT authorize a
different action. This SHALL hold at the tool surface itself, independently of
any confirmation the host app also shows (design.md §7.1).

#### Scenario: A destructive action is not carried out until it is confirmed
- **WHEN** the assistant is asked to close one of the host's running contests without a confirmation
- **THEN** the contest is not closed
- **AND** the assistant is told the action needs confirming

#### Scenario: A confirmed destructive action is carried out
- **WHEN** the assistant closes the contest with the confirmation it was given
- **THEN** the contest is closed

#### Scenario: A confirmation for one action does not authorize another
- **WHEN** the assistant tries to close a second contest using the confirmation issued for closing the first
- **THEN** the second contest is not closed
- **AND** the assistant is told the action needs confirming

### Requirement: A host can author and publish a contest through a connected assistant
A host SHALL be able to build a contest through the assistant: create a draft,
refine it, and publish it into a live contest. Creating and refining a draft are
ordinary reversible edits and SHALL happen directly. Publishing SHALL be treated
as a destructive action — a live contest cannot be un-published — and so SHALL
require the same confirmation as any other destructive action.

#### Scenario: The assistant creates a draft for the host
- **WHEN** the assistant is asked to create a draft with a given name for the host
- **THEN** a draft with that name is saved for the host

#### Scenario: The assistant renames a draft
- **WHEN** the assistant renames one of the host's drafts
- **THEN** the draft's name is changed

#### Scenario: Publishing a draft must be confirmed
- **WHEN** the assistant is asked to publish one of the host's drafts without a confirmation
- **THEN** the draft is not published
- **AND** the assistant is told the action needs confirming

#### Scenario: A confirmed publish creates a live contest
- **WHEN** the assistant publishes the draft with the confirmation it was given
- **THEN** the contest is live
