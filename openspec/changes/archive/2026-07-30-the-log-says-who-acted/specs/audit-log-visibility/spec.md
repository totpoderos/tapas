## ADDED Requirements

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
