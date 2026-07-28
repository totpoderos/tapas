# assistant-tool-surface Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
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

### Requirement: A host can list and find their contests by name through a connected assistant
So a host can talk to their assistant about contests the way they think of them — by name, not by an internal id — a host SHALL be able to have their connected assistant list all of their contests, and find one of their contests by name. Listing SHALL return all of the host's contests (drafts and published alike), each with its name and state. Finding by name SHALL match exactly but case-insensitively and return every contest with that name, so the assistant can ask the host which one when more than one shares a name. Both act strictly as that host — only the host's own contests, only while the token is valid — and the assistant decides nothing itself; a name that matches nothing simply comes back empty.

#### Scenario: The assistant lists the host's contests
- **WHEN** a host asks a connected assistant to list their contests, using their personal access token
- **THEN** the host's contests are listed

#### Scenario: The assistant lists only the host's own contests
- **WHEN** a host asks a connected assistant to list their contests while another host has a contest of their own, using their personal access token
- **THEN** the other host's contest is not listed

#### Scenario: The assistant finds a contest by name
- **WHEN** a host asks a connected assistant to find a contest by a name one of their contests has, using their personal access token
- **THEN** the matching contest is found

#### Scenario: The assistant is given every contest that shares a name
- **WHEN** a host asks a connected assistant to find a contest by a name two of their contests share, using their personal access token
- **THEN** both contests with that name are found

#### Scenario: The assistant finds only the host's own contests by name
- **WHEN** a host asks a connected assistant to find a contest by a name only another host's contest has, using their own token
- **THEN** no contest is found

### Requirement: A host can read a contest's details by name through a connected assistant
So a host can ask their assistant "who's in Tapas Night?" and get an answer, a host SHALL be able to have their connected assistant read one of their contests' details by name — who is taking part and how it is scored — reading the same whether the contest is a draft or published. It acts strictly as that host: only their own contests, only while the token is valid. When a name is shared by more than one contest the assistant SHALL be given the candidates so it can ask the host which one; a name that matches nothing comes back empty.

#### Scenario: The assistant reads a contest's details by name
- **WHEN** a host asks a connected assistant for the details of a contest named "Tapas Night" with Ana and Bob taking part, using their personal access token
- **THEN** the details name Ana and Bob as taking part

#### Scenario: The assistant is given the choice when several share a name
- **WHEN** a host asks a connected assistant for the details of a name two of their contests share, using their personal access token
- **THEN** both contests are offered to choose from

#### Scenario: The assistant reads only the host's own contest details by name
- **WHEN** a host asks a connected assistant for the details of a name only another host's contest has, using their own token
- **THEN** no contest is found

### Requirement: A host can manage a draft's participants through a connected assistant
A host SHALL be able to have their connected assistant add and remove the people taking part in a contest they are still preparing, naming the contest rather than quoting an id. This is for drafts only — once a contest is published its participants are settled. Adding is carried out straight away; removing someone is a destructive change, so the assistant SHALL NOT carry it out until the host confirms (see the destructive-action requirement). Both act strictly as that host — only the host's own drafts, only while the token is valid; a name shared by more than one draft returns the candidates to choose from, and a name that matches no draft comes back with none to change.

#### Scenario: The assistant adds a participant to a draft by name
- **WHEN** a host asks a connected assistant to add someone to one of their drafts, naming the draft, using their personal access token
- **THEN** that person is taking part in the draft

#### Scenario: Removing a participant is not carried out until the host confirms
- **WHEN** a host asks a connected assistant to remove someone from one of their drafts without a confirmation
- **THEN** the assistant asks the host to confirm first, and the person is still taking part

#### Scenario: The assistant removes a participant once the host confirms
- **WHEN** a host asks a connected assistant to remove someone from one of their drafts with a valid confirmation
- **THEN** that person is no longer taking part in the draft

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

### Requirement: A host can reveal a contest and read its results through a connected assistant
A host SHALL be able to reveal a closed contest and read its results through the
assistant. Revealing announces the winners and cannot be undone, so it SHALL be
treated as a destructive action requiring confirmation; reading the results is an
ordinary read that SHALL return the category totals and winners of a revealed
contest.

#### Scenario: Revealing a contest must be confirmed
- **WHEN** the assistant is asked to reveal one of the host's closed contests without a confirmation
- **THEN** the contest is not revealed
- **AND** the assistant is told the action needs confirming

#### Scenario: A confirmed reveal reveals the contest
- **WHEN** the assistant reveals the closed contest with the confirmation it was given
- **THEN** the contest is revealed

#### Scenario: The assistant reads the results of a revealed contest
- **WHEN** the assistant is asked to read the results of one of the host's revealed contests
- **THEN** the results are returned

### Requirement: The host can direct their contest in plain language through the assistant
The host SHALL be able to tell the assistant, in plain language, what they want
to do with their contest, and the assistant SHALL work out which action to take
from the tools available and propose it. When a request is ambiguous or missing
something a tool needs, the assistant SHALL ask the host to clarify rather than
guess an action. The assistant only proposes an action; carrying it out — and
confirming anything destructive — happens through the tools themselves.

#### Scenario: The assistant proposes an action for a clear request
- **WHEN** the host asks the assistant, in plain language, to close their contest
- **THEN** the assistant proposes closing that contest

#### Scenario: The assistant asks for clarification when a request is ambiguous
- **WHEN** the host asks for something the assistant cannot act on without more detail
- **THEN** the assistant asks the host to clarify instead of proposing an action

