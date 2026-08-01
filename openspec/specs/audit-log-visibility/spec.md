# audit-log-visibility Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A host can read the audit log of their own contest
A host SHALL be able to read the recorded history of a contest they own: every action taken on it, in order, each carrying who acted, when, and how it was triggered (its source). Reading SHALL be refused as not-allowed for a contest owned by a different host (OWASP A01 — ownership), and refused as not-signed-in when no one is signed in.

#### Scenario: The history of a contest spans its whole life
- **WHEN** a host who has published a contest and then closed it reads the contest's audit log
- **THEN** the log records that the contest was published
- **AND** the log records that the contest was closed
- **AND** each entry names who acted and when

#### Scenario: A host cannot read another host's audit log
- **WHEN** a host tries to read the audit log of a contest owned by a different host
- **THEN** it is refused as not allowed

#### Scenario: Reading the audit log requires being signed in
- **WHEN** a contest's audit log is requested with no one signed in
- **THEN** it is refused as not signed in

### Requirement: A host-confirmed destructive action is recorded as such
When a destructive action is carried out after the host confirms it through the assistant, the audit log SHALL record that the host confirmed it; an action taken without that explicit confirmation SHALL be recorded as automatic. This is the audit trail that shows the host approved an irreversible action (design.md §7.1).

#### Scenario: A destructive action approved through the assistant is recorded as host-confirmed
- **WHEN** a host closes their running contest through the assistant, confirming when asked, and then reads the contest's audit log
- **THEN** the closing is recorded as confirmed by the host

### Requirement: A recorded action says whether the host or their assistant did it
An action carried out because a host asked the assistant to SHALL be recorded as having come through a connected tool, and SHALL name the tool that carried it out. An action the host took in the app directly SHALL be recorded as having come from the app. The two SHALL be distinguishable in the record, because "did I do this, or did something acting for me?" is the question the history exists to answer.

The arguments the tool was invoked with SHALL be recorded alongside it, so the history says what was asked for and not only that something was asked.

Provenance SHALL describe how the action reached the system, and SHALL NOT be taken as saying who is answerable for it: an assistant acts only as the signed-in host, and the host is still the actor.

#### Scenario: An assistant renaming a draft is recorded as the assistant's work
- **WHEN** a host asks the assistant to rename one of their drafts, and then reads that contest's recorded history
- **THEN** the renaming is recorded as having come through a connected tool
- **AND** it names the tool that renamed it
- **AND** the new name it was asked for is recorded with it

#### Scenario: The same action taken in the app is recorded as the host's own
- **WHEN** a host renames a draft in the app, and then reads that contest's recorded history
- **THEN** the renaming is recorded as having come from the app
- **AND** it names no tool

#### Scenario: A host can tell the two apart in one history
- **WHEN** a host has renamed a draft in the app and also had the assistant rename it, and reads that contest's recorded history
- **THEN** the two renamings are recorded with different sources
- **AND** narrowing the history to what came through a connected tool leaves only the assistant's

#### Scenario: An assistant's action is still the host's action
- **WHEN** an action carried out through the assistant is recorded
- **THEN** the actor is the host who asked for it, not the assistant

#### Scenario: A destructive action through the assistant keeps saying the host confirmed it
- **WHEN** a host closes their running contest through the assistant, confirming when asked, and then reads the contest's recorded history
- **THEN** the closing is recorded as having come through a connected tool
- **AND** it is still recorded as confirmed by the host

### Requirement: A host can take their contest's activity log away as a file
A host SHALL be able to take the recorded history of a contest they own away as a comma-separated file, carrying the same entries the screen shows and in the same order: what happened, how it was triggered, who acted, whether the host confirmed it, and when. The file SHALL be named after the contest it belongs to. Taking the log away SHALL be refused for a contest owned by a different host, and refused when no one is signed in — the same ownership rule as reading it on screen.

#### Scenario: The file carries what the screen shows
- **WHEN** a host who has published and then closed a contest takes its activity log away as a file
- **THEN** the file has a row for the contest being published and a row for it being closed
- **AND** each row carries how the action was triggered, who acted, and when

#### Scenario: The file is named after its contest
- **WHEN** a host takes the activity log of a contest away as a file
- **THEN** the file is named after that contest

#### Scenario: A host cannot take away another host's log
- **WHEN** a host tries to take away the activity log of a contest owned by a different host
- **THEN** it is refused as not allowed

#### Scenario: Taking the log away requires being signed in
- **WHEN** a contest's activity log is asked for as a file with no one signed in
- **THEN** it is refused as not signed in

#### Scenario: A value that could be read as a formula is made inert
- **WHEN** an entry's text begins with a character a spreadsheet would treat as the start of a formula
- **THEN** the file writes it so that a spreadsheet shows it as text rather than running it

#### Scenario: A value containing a separator or a quote survives the trip
- **WHEN** an entry's text contains a comma, a quotation mark, or a line break
- **THEN** the file quotes and escapes it so the row still reads as one row with its fields intact

