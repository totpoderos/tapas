## ADDED Requirements

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
