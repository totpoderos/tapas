# converse-with-the-host-assistant Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A signed-in host directs their contest by chatting with the assistant
A signed-in host SHALL be able to send the assistant a message in plain language and have it either ask for clarification, carry out a reversible action on their behalf, or report what it did. The assistant SHALL act strictly as that host — every action it takes is subject to the same ownership and validation rules as if the host did it directly — and chatting SHALL be refused when no one is signed in. This is the in-app conversation, distinct from an external assistant connected by a personal access token (design.md §7).

#### Scenario: The assistant asks for detail when a request is ambiguous
- **WHEN** a signed-in host asks the assistant for something it cannot act on without more detail
- **THEN** the assistant replies asking them to clarify
- **AND** nothing about their contest changes

#### Scenario: The assistant carries out a reversible action and reports it
- **WHEN** a signed-in host asks the assistant to start a new draft with a given name
- **THEN** a draft with that name is saved for them
- **AND** the assistant reports that it did so

#### Scenario: Chatting with the assistant requires being signed in
- **WHEN** a message is sent to the assistant with no one signed in
- **THEN** it is refused as not signed in

### Requirement: The in-app assistant confirms a destructive action before carrying it out
A destructive action requested through the in-app assistant (such as closing a contest) SHALL NOT be carried out on the first request; instead the host SHALL be given a confirmation for that exact action to send back, and only a request carrying the matching confirmation SHALL carry it out. A confirmation SHALL authorise only the action it was issued for, and MUST NOT authorise a different action.

#### Scenario: A destructive action is not carried out until the host confirms
- **WHEN** a signed-in host asks the assistant to close one of their running contests
- **THEN** the contest is not closed
- **AND** the assistant asks the host to confirm closing it

#### Scenario: Confirming carries out the destructive action
- **WHEN** the host confirms closing the contest with the confirmation they were given
- **THEN** the contest is closed

#### Scenario: A confirmation authorises only the action it was given for
- **WHEN** a confirmation issued for closing one contest is used to try to close a different contest
- **THEN** the different contest is not closed
- **AND** the host is asked to confirm that action instead

### Requirement: The panel asks which contest is meant whenever a name is shared

The panel SHALL ask which contest is meant whenever a host names one that more
than one of their contests bears, showing the candidates and changing nothing
until the host says. This SHALL hold for every action the assistant can take,
not only for reading — a host who has reused a name must be able to close,
publish, reveal, delete or edit the right one without ever seeing an internal
id.

A name that matches none of the host's contests SHALL be reported plainly as
matching nothing, distinctly from an action that was attempted and failed, so a
host can tell a mistyped name from a refused change.

#### Scenario: The panel offers the choice when a name is shared

- **WHEN** a signed-in host asks the assistant to act on a name two of their contests share
- **THEN** the panel shows both contests and asks which one is meant
- **AND** neither contest is changed

#### Scenario: The panel says plainly when a name matches nothing

- **WHEN** a signed-in host asks the assistant to act on a name none of their contests has
- **THEN** the panel says no contest has that name
- **AND** it does not read as an action that failed

### Requirement: The panel says in words what the assistant changed about a draft

The panel SHALL say what a rule change did in the host's own terms — what the
draft is now judged on, what kind of contest it now is, how it is now scored,
who is now partnered with whom — rather than echoing the call that was made. A
host reads the panel to know the state of their contest, so what it reports
SHALL be the state the change produced.

A refused change SHALL be shown as a refusal carrying its reason, and SHALL NOT
be shown in the same way as a change that succeeded.

#### Scenario: The panel reports a rule the assistant changed

- **WHEN** a signed-in host asks the assistant to add a scoring category to one of their drafts
- **THEN** the panel reports what the draft is now judged on

#### Scenario: The panel shows a refused change as a refusal, with its reason

- **WHEN** a signed-in host asks the assistant for a change to a draft that cannot stand
- **THEN** the panel shows it as refused and gives the reason
- **AND** the draft is unchanged

#### Scenario: A destructive edit is confirmed before it is carried out

- **WHEN** a signed-in host asks the assistant to remove a scoring category from one of their drafts
- **THEN** the draft is still judged on that category
- **AND** the assistant asks the host to confirm removing it

