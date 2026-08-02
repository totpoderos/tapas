# contest-management-api Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: A host drives a contest from draft to live over the API
A signed-in host SHALL be able to save a draft and publish it into a live contest through the API, producing a join code participants can then use.

#### Scenario: A host takes a contest from draft to live, and it can be joined
- **WHEN** a signed-in host saves a complete draft and publishes it through the API
- **THEN** a live contest with a join code exists
- **AND** a participant can join that contest with the code

### Requirement: A host can edit a draft's rules over the API
While a contest is still a draft, a host SHALL be able to change any of its rules through the API — its format, its scoring, who is taking part (adding or removing participants), and who is paired with whom — not only its name. A draft need not be complete or valid to be saved this way; only its name is required (the full rules are checked at publish). Editing SHALL only ever change the host's own draft, and SHALL be refused when no one is signed in.

There SHALL be no way through the API to bar a chosen pair from scoring each other independently of the format and the pairings: a contest's format and who is paired with whom are together the whole answer to who may not score whom.

#### Scenario: A host changes their draft's format, scoring and participants
- **WHEN** a host revises their draft's format, scoring categories and participants through the API
- **THEN** the stored draft reflects the revised rules
- **AND** the audit log records the change

#### Scenario: A host removes a participant from their draft
- **WHEN** a host revises their draft to remove one of its participants through the API
- **THEN** that participant is no longer part of the stored draft

#### Scenario: An unknown format is refused
- **WHEN** a host tries to revise their draft to a format that is not one of the three through the API
- **THEN** the revision is rejected because the format is not one the contest can have
- **AND** the stored draft is unchanged

#### Scenario: An edited draft still requires a name
- **WHEN** a host tries to revise their draft to have no name through the API
- **THEN** the revision is rejected because a name is required

#### Scenario: A host cannot edit another host's draft
- **WHEN** a host tries to revise a draft owned by a different host through the API
- **THEN** the revision is refused and the other host's draft is unchanged

#### Scenario: Editing a draft requires being signed in
- **WHEN** editing a draft is attempted through the API with no one signed in
- **THEN** the API refuses it as not authorized

### Requirement: A host can add and remove a draft's participants by name over the API
A host SHALL be able to add a participant to, and remove a participant from, one of their own contest *drafts* through the API, naming the contest rather than quoting an id. This is for drafts only — a published contest's participants are settled. Removing a participant SHALL also clear any pairing that named them, so a draft never holds a dangling reference. Resolution SHALL be exact but case-insensitive over the host's own drafts; a name shared by more than one draft returns the candidates to choose from, and a name matching no draft (including a published contest's or another host's) returns none. It SHALL be refused when no one is signed in.

#### Scenario: A host adds a participant to a draft by name
- **WHEN** a host adds a participant to one of their drafts, naming the draft, through the API
- **THEN** that participant is taking part in the draft

#### Scenario: A host removes a participant from a draft by name
- **WHEN** a host removes a participant from one of their drafts, naming the draft, through the API
- **THEN** that participant is no longer taking part in the draft

#### Scenario: Managing participants of a published contest by name finds no draft
- **WHEN** a host tries to add a participant to a name that only a published contest has
- **THEN** no draft is found to change

#### Scenario: Managing draft participants requires being signed in
- **WHEN** adding a participant is attempted through the API with no one signed in
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

Each listed contest SHALL also carry enough to be read without opening it:
- its rules in brief — its format, and how many scoring categories it has;
- its join code, once it has one;
- how its voting is progressing — how many people have claimed a place, how many are still scoring, and how many have sent their vote.

A contest still being prepared has no join code and no progress, and SHALL report none rather than zeroes, so that "nobody has voted yet" and "voting has not started" are told apart. Rules a draft has not been given yet SHALL likewise report none. Listing SHALL remain one request: reading the list SHALL NOT require a further request per contest.

#### Scenario: A host sees their contests across every state, each marked with its state
- **WHEN** a signed-in host who is preparing one contest, has a live contest, and has a revealed contest lists their contests
- **THEN** all three contests are listed
- **AND** the one being prepared is marked as being prepared, the live one as live, and the revealed one as revealed

#### Scenario: A contest whose voting has closed is listed as closed
- **WHEN** a signed-in host whose contest has had its voting closed lists their contests
- **THEN** that contest is marked as closed

#### Scenario: A live contest is listed with its progress
- **WHEN** a signed-in host lists their contests, and their live contest has eighteen people who claimed a place, of whom thirteen have sent their vote and five are still scoring
- **THEN** that contest is listed as having eighteen claimed, thirteen sent, and five still scoring

#### Scenario: A live contest is listed with its rules in brief and its join code
- **WHEN** a signed-in host lists their contests, and their live contest is one where everyone is on their own, across four categories
- **THEN** that contest is listed as one where everyone is on their own, with four categories
- **AND** it is listed with the join code participants use for it

#### Scenario: A contest being prepared reports no join code and no progress
- **WHEN** a signed-in host lists their contests and one of them is still being prepared
- **THEN** that contest is listed with no join code and no progress
- **AND** it is not listed as having nobody claimed and nobody voted

#### Scenario: Listing the whole list takes one request
- **WHEN** a signed-in host with several contests lists them
- **THEN** the progress and rules of every contest arrive with that one answer

#### Scenario: A host only sees their own contests
- **WHEN** a host with a contest, alongside a second host with their own contest, lists their contests through the API
- **THEN** only the requesting host's contest is listed

#### Scenario: Another host's progress is not disclosed
- **WHEN** a host lists their contests while a second host has a live contest with votes in it
- **THEN** nothing about the second host's contest, its join code or its progress is included

#### Scenario: Listing contests requires being signed in
- **WHEN** listing contests is attempted through the API with no one signed in
- **THEN** the API refuses it as not signed in

### Requirement: A host can read their own contest over the API
A host SHALL be able to read a contest they own through the API.

The read SHALL report the rules the contest is being played by, so that a host running it can see what it was published with without opening the draft it came from — which no longer exists. That includes its format, what the contest is judged on, the score band, and whether a score may be used more than once in a category. The format is the whole of what the contest says about who cooks and who may not score whom, so there is no second rule to report beside it.

The format SHALL be reported from what the contest recorded at publish, not reconstructed from the compiled constraint view. The compiler consumes the format into the set of dishes each judge may score, so the compiled view holds its consequence and not the format itself: where nobody has a partner, a contest where everyone is on their own and one where partners are kept apart compile to exactly the same thing. A contest that never recorded a format SHALL report that it does not say, rather than a guess.

#### Scenario: A host reads their own published contest through the API
- **WHEN** a host who has published a contest reads that contest through the API
- **THEN** the contest's details are returned

#### Scenario: The read reports the rules the contest is being played by
- **WHEN** a host reads a contest they published where everyone is on their own with partners kept apart, judged on three categories from one to ten with each score used once
- **THEN** the read reports that everyone is on their own with partners kept apart
- **AND** it reports the three categories, the band from one to ten, and that a score is used only once in a category

#### Scenario: A contest that never recorded its format says so
- **WHEN** a host reads a contest that has no format recorded
- **THEN** the read reports that the contest does not say what its format is
- **AND** it does not report a format inferred from the compiled view

### Requirement: A contest reports the link that joins it
When a host reads a contest they own, the read SHALL report a **join link** beside its join code: the address that opens the participant app already carrying that contest's join code, so that following it asks nobody to type the code.

The join link SHALL be built from the participant address the deployment is configured with, so that a contest read from a deployment reports the link to that deployment's own participant app and not to another. It SHALL carry that address and the contest's join code, and nothing about the contest, its host, or its participants.

The join link SHALL carry the same join code the same read reports, so that a link can never lead somewhere other than the contest it was read from.

Reporting the link SHALL NOT require a further request: it arrives with the contest, as the join code does.

#### Scenario: A host reads their contest and is given the link that joins it
- **WHEN** a host reads a live contest they own
- **THEN** the read reports a join link as well as the join code
- **AND** the join link is the participant app's address carrying that contest's join code

#### Scenario: The join link carries the contest's own join code
- **WHEN** a host who owns two live contests reads each of them
- **THEN** each read reports a join link carrying that contest's own join code
- **AND** the two join links differ

#### Scenario: The join link says nothing else about the contest
- **WHEN** a host reads a live contest they own
- **THEN** the join link carries the participant address and the join code only
- **AND** it carries nothing about the contest's name, its host, or its participants

#### Scenario: The join link leads to the deployment's own participant app
- **WHEN** a contest is read on a deployment whose participant address is its own
- **THEN** the join link reported begins with that deployment's participant address

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

