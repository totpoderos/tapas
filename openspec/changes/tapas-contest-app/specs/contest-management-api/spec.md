## ADDED Requirements

### Requirement: A host drives a contest from draft to live over the API
A signed-in host SHALL be able to save a draft and publish it into a live contest through the API, producing a join code participants can then use.

#### Scenario: A host takes a contest from draft to live, and it can be joined
- **WHEN** a signed-in host saves a complete draft and publishes it through the API
- **THEN** a live contest with a join code exists
- **AND** a participant can join that contest with the code

### Requirement: A host can edit a draft's rules over the API
While a contest is still a draft, a host SHALL be able to change any of its rules through the API — how dishes are attributed, the anti-bias pairings, the scoring, who is taking part (adding or removing participants), which participants are a couple, and which participants may not score each other — not only its name. A draft need not be complete or valid to be saved this way; only its name is required (the full rules are checked at publish). Editing SHALL only ever change the host's own draft, and SHALL be refused when no one is signed in.

#### Scenario: A host changes their draft's attribution, anti-bias, scoring and participants
- **WHEN** a host revises their draft's attribution, anti-bias, scoring categories and participants through the API
- **THEN** the stored draft reflects the revised rules
- **AND** the audit log records the change

#### Scenario: A host removes a participant from their draft
- **WHEN** a host revises their draft to remove one of its participants through the API
- **THEN** that participant is no longer part of the stored draft

#### Scenario: An edited draft still requires a name
- **WHEN** a host tries to revise their draft to have no name through the API
- **THEN** the revision is rejected because a name is required

#### Scenario: A host cannot edit another host's draft
- **WHEN** a host tries to revise a draft owned by a different host through the API
- **THEN** the revision is refused and the other host's draft is unchanged

#### Scenario: Editing a draft requires being signed in
- **WHEN** editing a draft is attempted through the API with no one signed in
- **THEN** the API refuses it as not authorized

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

### Requirement: A host can list all of their contests over the API
A host SHALL be able to list all of their own contests through the API in one place — drafts still being prepared and published contests alike — each marked with the state it is in (being prepared, live, closed, or revealed). Listing SHALL return only that host's contests.

#### Scenario: A host sees their contests across every state, each marked with its state
- **WHEN** a signed-in host who is preparing one contest, has a live contest, and has a revealed contest lists their contests
- **THEN** all three contests are listed
- **AND** the one being prepared is marked as being prepared, the live one as live, and the revealed one as revealed

#### Scenario: A contest whose voting has closed is listed as closed
- **WHEN** a signed-in host whose contest has had its voting closed lists their contests
- **THEN** that contest is marked as closed

#### Scenario: A host only sees their own contests
- **WHEN** a host with a contest, alongside a second host with their own contest, lists their contests through the API
- **THEN** only the requesting host's contest is listed

#### Scenario: Listing contests requires being signed in
- **WHEN** listing contests is attempted through the API with no one signed in
- **THEN** the API refuses it as not signed in

### Requirement: A host can read their own contest over the API
A host SHALL be able to read a contest they own through the API.

#### Scenario: A host reads their own published contest through the API
- **WHEN** a host who has published a contest reads that contest through the API
- **THEN** the contest's details are returned

### Requirement: A host can find their own contest by name over the API
A host SHALL be able to find their own contests by name through the API, so they can refer to a contest the way they say it rather than by an internal id. Matching SHALL be exact but case-insensitive (a partial name SHALL NOT match, so a name cannot resolve to the wrong contest). Because a name is not unique, all matches SHALL be returned. Finding SHALL search only the requesting host's own contests, and SHALL be refused when no one is signed in.

#### Scenario: A host finds their contest by its exact name
- **WHEN** a host who owns a contest named "Tapas Night" looks for a contest named "Tapas Night" through the API
- **THEN** the contest named "Tapas Night" is found

#### Scenario: Finding a contest by name ignores capitalisation
- **WHEN** a host who owns a contest named "Tapas Night" looks for a contest named "tapas night" through the API
- **THEN** the contest named "Tapas Night" is found

#### Scenario: When two contests share a name, all of them are found
- **WHEN** a host who owns two contests both named "Tapas Night" looks for a contest named "Tapas Night" through the API
- **THEN** both contests named "Tapas Night" are found

#### Scenario: A name that matches nothing finds nothing
- **WHEN** a host looks for a contest by a name none of their contests has
- **THEN** no contest is found

#### Scenario: A host cannot find another host's contest by name
- **WHEN** a host looks for a contest by a name only another host's contest has
- **THEN** no contest is found

#### Scenario: Finding a contest by name requires being signed in
- **WHEN** finding a contest by name is attempted through the API with no one signed in
- **THEN** the API refuses it as not authorized

### Requirement: A host can read a contest's details by name over the API
A host SHALL be able to read the details of one of their own contests by name through the API — who is taking part and how it is scored — reading the same whether the contest is a draft or already published. Resolution SHALL be exact but case-insensitive over the host's own contests. When the name resolves to a single contest its details SHALL be returned; when a name is shared by more than one contest the candidates SHALL be returned so the host can choose; a name that matches nothing SHALL return no candidates. It SHALL be refused when no one is signed in.

#### Scenario: A host reads their draft's participants and categories by name
- **WHEN** a host who is preparing a draft named "Tapas Night" with Ana and Bob taking part and a "Taste" category asks for its details through the API
- **THEN** the details name Ana and Bob as taking part and "Taste" as a category

#### Scenario: A host reads their live contest's details by name
- **WHEN** a host who has a live contest named "Balcony Cook-off" with Ana and Bob taking part asks for its details through the API
- **THEN** the details name Ana and Bob as taking part

#### Scenario: When two contests share a name, the details request offers the choice
- **WHEN** a host who has two contests both named "Tapas Night" asks for the details of "Tapas Night"
- **THEN** both contests are offered to choose from

#### Scenario: A host cannot read another host's contest details by name
- **WHEN** a host asks for the details of a name only another host's contest has
- **THEN** no contest is found

#### Scenario: Reading a contest's details by name requires being signed in
- **WHEN** reading a contest's details by name is attempted through the API with no one signed in
- **THEN** the API refuses it as not authorized

### Requirement: API contest operations enforce ownership and authentication
Contest and draft operations over the API SHALL be refused when no one is signed in, and refused as not-allowed when the signed-in host is acting on another host's work.

#### Scenario: A host cannot publish another host's draft through the API
- **WHEN** a signed-in host tries to publish a draft owned by a different host through the API
- **THEN** the API refuses it as not allowed

#### Scenario: Publishing requires being signed in
- **WHEN** publishing a draft is attempted through the API with no one signed in
- **THEN** the API refuses it as not signed in
