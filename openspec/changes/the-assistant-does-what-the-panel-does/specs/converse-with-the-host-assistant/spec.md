## ADDED Requirements

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
