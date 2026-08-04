## MODIFIED Requirements

### Requirement: A host can author and publish a contest through a connected assistant

A host SHALL be able to build a contest through the assistant: create a draft,
refine it, and publish it into a live contest. Creating and refining a draft are
ordinary reversible edits and SHALL happen directly. Publishing SHALL be treated
as a destructive action — a live contest cannot be un-published — and so SHALL
require the same confirmation as any other destructive action. The draft to
rename or publish SHALL be named, not quoted by id.

A whole contest SHALL be creatable in one asking, with everything the host said
in it — what it is called, what kind it is, who is taking part, and what it is
judged on. Nothing the host has never been shown SHALL be asked of the assistant
in order to do so: an internal id is identity the system keeps, not something a
host states, so neither a participant nor a scoring category SHALL have to arrive
with one. A category that arrives without an id SHALL be given one, exactly as a
participant already is, and a category that arrives with one SHALL keep it.

#### Scenario: The assistant creates a draft for the host

- **WHEN** the assistant is asked to create a draft with a given name for the host
- **THEN** a draft with that name is saved for the host

#### Scenario: The assistant sets up a whole contest in one asking

- **WHEN** the assistant is asked to create a contest with a name, two things to be judged on, three people taking part, and a score range, in one message
- **THEN** a draft with that name is saved for the host
- **AND** it is judged on both of those things
- **AND** all three of those people are taking part in it
- **AND** it is scored within that range

#### Scenario: A scoring category the assistant did not name an id for is still one thing

- **WHEN** the assistant sets up a contest judged on two things without stating an id for either
- **THEN** the draft is judged on two things, each of which the host can name and remove on its own

#### Scenario: The assistant renames a draft

- **WHEN** the assistant renames one of the host's drafts, naming the draft
- **THEN** the draft's name is changed

#### Scenario: Publishing a draft must be confirmed

- **WHEN** the assistant is asked to publish one of the host's drafts, naming it, without a confirmation
- **THEN** the draft is not published
- **AND** the assistant is told the action needs confirming

#### Scenario: A confirmed publish creates a live contest

- **WHEN** the assistant publishes the draft with the confirmation it was given
- **THEN** the contest is live
