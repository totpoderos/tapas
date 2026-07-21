## ADDED Requirements

### Requirement: A host saves a new draft
A host SHALL be able to save a new contest draft by name, together with its rule-space configuration (attribution, anti-bias mode, scoring). The draft SHALL be stored, SHALL appear among that host's drafts, and the save SHALL be recorded in the audit log.

#### Scenario: A host saves a new draft
- **WHEN** a host saves a draft named "Summer Tapas 2026" scored per person with couples barred
- **THEN** the draft is stored
- **AND** the draft appears among the host's drafts
- **AND** the audit log records that the draft was saved by that host

### Requirement: A draft without a name cannot be saved
A name SHALL be required to save a draft. Saving without one SHALL be rejected before anything is stored.

#### Scenario: A draft without a name cannot be saved
- **WHEN** a host tries to save a draft with no name
- **THEN** saving is rejected because a name is required

### Requirement: A host only sees their own drafts
Listing a host's drafts SHALL return only drafts owned by that host (OWASP A01 — ownership, not just authentication, gates visibility).

#### Scenario: A host only sees their own drafts
- **WHEN** a host with a saved draft named "Summer Tapas 2026", and another host with a saved draft named "Winter Tapas", lists their own drafts
- **THEN** only "Summer Tapas 2026" appears

### Requirement: A host can extract a contest draft from a chat message
A signed-in host SHALL be able to describe a contest in a free-form message and have the assistant extract what it can into a draft. Every extracted field SHALL be tagged with its source (what the host said, what the assistant inferred, or a default the assistant proposed). Anything the assistant could not determine SHALL be listed as a clarification instead of guessed.

#### Scenario: A complete message extracts a full draft with no clarifications needed
- **WHEN** a host asks the assistant to extract a draft from a message that fully describes a contest
- **THEN** the extracted draft includes every field, tagged with its source
- **AND** there are no clarifications

#### Scenario: A partial message extracts what it can and asks for the rest
- **WHEN** a host asks the assistant to extract a draft from a message that leaves out the participants
- **THEN** the extracted draft includes what could be determined
- **AND** the clarifications list asks for the participants

#### Scenario: Extraction requires being signed in
- **WHEN** a draft extraction is attempted with no one signed in
- **THEN** it is refused as not signed in

### Requirement: The assistant may never default a high-stakes field
Attribution, anti-bias, scoring, and participants SHALL never be filled in with an assistant-proposed default — only from what the host explicitly said. If the assistant proposes a default for one of these fields anyway, it SHALL be dropped from the extracted draft and replaced with a clarification asking the host to specify it.

#### Scenario: The assistant may not default a high-stakes field
- **WHEN** the assistant's response defaults the attribution field without the host having said so
- **THEN** the attribution field is dropped from the draft
- **AND** a clarification asks the host to specify it
