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
