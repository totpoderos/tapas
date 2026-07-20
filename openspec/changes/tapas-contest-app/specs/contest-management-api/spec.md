## ADDED Requirements

### Requirement: A host drives a contest from draft to live over the API
A signed-in host SHALL be able to save a draft and publish it into a live contest through the API, producing a join code participants can then use.

#### Scenario: A host takes a contest from draft to live, and it can be joined
- **WHEN** a signed-in host saves a complete draft and publishes it through the API
- **THEN** a live contest with a join code exists
- **AND** a participant can join that contest with the code

### Requirement: Draft management is available over the API, scoped to the host
A host SHALL be able to list, rename, and discard their own drafts through the API. Listing SHALL return only that host's drafts.

#### Scenario: A host sees only their own drafts through the API
- **WHEN** a host with a saved draft, alongside a second host with their own saved draft, lists their drafts through the API
- **THEN** only the requesting host's draft is listed

#### Scenario: A host renames a draft through the API
- **WHEN** a host renames their saved draft "Summer Tapas" to "Summer Tapas Final" through the API
- **THEN** the stored draft is named "Summer Tapas Final"

#### Scenario: A host discards a draft through the API
- **WHEN** a host discards their saved draft through the API
- **THEN** the draft no longer appears among their drafts

### Requirement: A host can read their own contest over the API
A host SHALL be able to read a contest they own through the API.

#### Scenario: A host reads their own published contest through the API
- **WHEN** a host who has published a contest reads that contest through the API
- **THEN** the contest's details are returned

### Requirement: API contest operations enforce ownership and authentication
Contest and draft operations over the API SHALL be refused when no one is signed in, and refused as not-allowed when the signed-in host is acting on another host's work.

#### Scenario: A host cannot publish another host's draft through the API
- **WHEN** a signed-in host tries to publish a draft owned by a different host through the API
- **THEN** the API refuses it as not allowed

#### Scenario: Publishing requires being signed in
- **WHEN** publishing a draft is attempted through the API with no one signed in
- **THEN** the API refuses it as not signed in
