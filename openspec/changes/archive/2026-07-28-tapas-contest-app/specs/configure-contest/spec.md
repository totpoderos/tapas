## ADDED Requirements

### Requirement: A host edits a draft
A host SHALL be able to rename their own saved draft. The change SHALL be recorded in the audit log together with the previous and the new name.

#### Scenario: A host edits a draft
- **WHEN** a host with a saved draft named "Summer Tapas 2026" renames it to "Summer Tapas Final"
- **THEN** the stored draft is named "Summer Tapas Final"
- **AND** the audit log records the change with the previous and the new name

### Requirement: A host discards a draft
A host SHALL be able to discard their own saved draft. Once discarded, the draft SHALL no longer appear among the host's drafts, and the discard SHALL be recorded in the audit log.

#### Scenario: A host discards a draft
- **WHEN** a host with a saved draft named "Summer Tapas 2026" discards the draft
- **THEN** the draft no longer appears among the host's drafts
- **AND** the audit log records that the draft was discarded
