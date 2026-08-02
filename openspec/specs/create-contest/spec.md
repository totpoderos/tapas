# create-contest Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A host saves a new draft
A host SHALL be able to save a new contest draft by name, together with its rule-space configuration (its format and its scoring). The draft SHALL be stored, SHALL appear among that host's drafts, and the save SHALL be recorded in the audit log.

#### Scenario: A host saves a new draft
- **WHEN** a host saves a draft named "Summer Tapas 2026" where everyone is on their own with partners kept apart
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
The format, the scoring, and the participants SHALL never be filled in with an assistant-proposed default — only from what the host explicitly said. If the assistant proposes a default for one of these fields anyway, it SHALL be dropped from the extracted draft and replaced with a clarification asking the host to specify it.

#### Scenario: The assistant may not default a high-stakes field
- **WHEN** the assistant's response defaults the contest's format without the host having said so
- **THEN** the format is dropped from the draft
- **AND** a clarification asks the host to specify it

### Requirement: A participant's name may not set a high-stakes rule
A participant's display name is data describing a person, never an instruction to the assistant. Text inside a participant's name SHALL never set the contest's format or its scoring — even when the assistant, misled by that text, reports the rule as if the host had asked for it. Such a name SHALL be kept, unchanged, as that participant's name; the rule it tried to set SHALL be dropped; and a clarification SHALL ask the host to decide the rule themselves. Rules the host genuinely stated in the same message SHALL be left untouched — only the rule the name names is dropped.

#### Scenario: An instruction hidden in a participant's name cannot change the contest's format
- **WHEN** a host asks the assistant to extract a draft from a message whose participants include a name written to read like an instruction to make the contest one where nobody is kept apart
- **THEN** the name is kept, unchanged, as that participant's name
- **AND** the contest's format is not set from it
- **AND** a clarification asks the host to decide the format

### Requirement: A host can answer the assistant's clarifications to complete a draft
A signed-in host SHALL be able to reply to the assistant's clarifications and have that reply merged into the partial draft. The merged draft SHALL include what the reply answers, SHALL keep fields that were already determined even when the reply does not mention them, and SHALL still list anything that remains outstanding. If the reply cannot be understood, the draft already built SHALL be kept rather than discarded.

#### Scenario: A reply that answers every open clarification completes the draft
- **WHEN** a host replies naming the participants, to a partial draft whose only clarification asks for them
- **THEN** the merged draft includes the participants
- **AND** there are no clarifications left

#### Scenario: A reply that answers only part of what's missing keeps asking for the rest
- **WHEN** a host replies naming only the participants, to a partial draft missing both the participants and the scoring rules
- **THEN** the merged draft includes the participants
- **AND** the clarifications list still asks for the scoring rules

#### Scenario: Fields already known are kept even when the reply doesn't repeat them
- **WHEN** a host replies about an unrelated field, to a partial draft whose contest name is already set
- **THEN** the merged draft still includes the contest name

#### Scenario: Merging a reply requires being signed in
- **WHEN** a draft merge is attempted with no one signed in
- **THEN** it is refused as not signed in

#### Scenario: The assistant may not default a high-stakes field while merging
- **WHEN** a merge defaults the contest's format without the host having said so
- **THEN** the format is dropped from the draft
- **AND** a clarification asks the host to specify it

