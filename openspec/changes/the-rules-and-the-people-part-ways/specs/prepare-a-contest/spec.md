## ADDED Requirements

### Requirement: A contest being prepared has two sections
A contest that has not yet gone live SHALL be prepared in two sections rather than on one screen. One section SHALL hold its **rules** — what it is called, whether dishes are attributed per person or per couple, the anti-bias rule, the scoring categories, the score range, and whether scores must be unique within a category. The other SHALL hold its **participants and pairing** — who is taking part, who is paired with whom, and which pairs may not score each other. Everything a host could settle on the one screen SHALL be settled on one of the two, and nothing SHALL appear on both.

#### Scenario: The rules are settled in their own section
- **WHEN** a signed-in host opens the rules of a contest they are preparing
- **THEN** they can change what it is called, how dishes are attributed, its anti-bias rule, its scoring categories, its score range, and whether scores must be unique within a category
- **AND** the roster, the pairings and the barred pairs are not on that section

#### Scenario: The people are settled in their own section
- **WHEN** a signed-in host opens the participants and pairing of a contest they are preparing
- **THEN** they can add and remove people, pair them as couples, and bar pairs from scoring each other
- **AND** the contest's name, attribution, anti-bias rule and scoring are not on that section

### Requirement: The navigation offers both sections of a contest being prepared
When a host is inside a contest being prepared, the panel's navigation SHALL name it, say that it has not been published, and offer both of its sections as separate ways in. The section the host is on SHALL be marked as the current one, and moving between them SHALL be a single step from either.

#### Scenario: Both sections are offered under the draft's name
- **WHEN** a signed-in host is on either section of a contest they are preparing
- **THEN** the navigation names that contest and says it has not been published
- **AND** it offers the way to its rules and the way to its participants and pairing

#### Scenario: The navigation says which section the host is on
- **WHEN** a signed-in host is on the participants and pairing of a contest they are preparing
- **THEN** the navigation marks that section as the current one
- **AND** it does not mark the rules as current

#### Scenario: Moving between the sections takes one step
- **WHEN** a signed-in host on the rules of a contest they are preparing takes the way to its participants and pairing
- **THEN** they are on that section, still inside the same contest

### Requirement: Edits survive moving between the sections
The two sections SHALL be two views of one contest being prepared, not two screens with two copies of it. A change made in one section and not yet saved SHALL still be there after moving to the other and back, and moving between them SHALL neither save, discard, nor warn about unsaved work.

#### Scenario: An unsaved change is still there after moving away and back
- **WHEN** a signed-in host changes the name of a contest they are preparing, moves to its participants and pairing, and comes back to its rules
- **THEN** the name they typed is still there
- **AND** they were not asked about unsaved work on the way

#### Scenario: Moving between the sections does not save
- **WHEN** a signed-in host changes the name of a contest they are preparing and moves to its participants and pairing without saving
- **THEN** the stored contest is still called what it was called before

### Requirement: One save stores the whole contest being prepared, from either section
Saving SHALL store everything the host has changed across both sections, whichever section they save from, and SHALL say that it has happened. A host SHALL never have to save each section separately.

#### Scenario: A change to each section is stored by one save
- **WHEN** a signed-in host changes the name on the rules of a contest they are preparing, adds a person on its participants and pairing, and saves
- **THEN** the stored contest has both the new name and the new person
- **AND** they are told it was saved

#### Scenario: Saving is offered on both sections
- **WHEN** a signed-in host is on either section of a contest they are preparing
- **THEN** saving is offered in the panel's header

#### Scenario: A contest being prepared still cannot be saved without a name
- **WHEN** a signed-in host clears the name of a contest they are preparing and tries to save from its participants and pairing
- **THEN** they are told a name is needed
- **AND** nothing is changed

### Requirement: Publishing and what is still missing are offered on both sections
The publish checklist describes the whole contest being prepared and not one section of it, so both sections SHALL say what is ready and what is not, and both SHALL offer publishing. What the contest still needs SHALL also be said in the panel, where a host can see it without scrolling the section they are on.

#### Scenario: What is still missing is said on either section
- **WHEN** a signed-in host is preparing a contest scored per couple, two of whose participants have no partner
- **THEN** both its rules and its participants and pairing list what is ready and what is not
- **AND** both say two participants still need a partner
- **AND** the panel says so too, without scrolling

#### Scenario: A contest is published from the section the host is on
- **WHEN** a signed-in host on the rules of a complete contest they are preparing publishes it
- **THEN** it is live
- **AND** they are taken to its control room, where its join code is waiting

#### Scenario: Publishing an incomplete contest from either section takes it nowhere
- **WHEN** a signed-in host on the participants and pairing of an incomplete contest they are preparing tries to publish it
- **THEN** they are told why it cannot go live
- **AND** it is still a contest being prepared
- **AND** they are still on the section they were on

### Requirement: Both sections are accessible and read in either language
Each section SHALL be operable by keyboard alone with focus always visible, SHALL be free of accessibility violations, and SHALL read in whichever language the host has chosen, leaving the contest's own name and the participants' names as they were written.

#### Scenario: Each section is keyboard-operable and free of violations
- **WHEN** a signed-in host moves through either section of a contest they are preparing using only the keyboard
- **THEN** every field and action can be reached and taken, each showing where focus is
- **AND** the section has no accessibility violations

#### Scenario: Both sections read in Spanish
- **WHEN** a signed-in host preparing a contest switches the language to Spanish
- **THEN** everything both sections say is in Spanish, including their names in the navigation
- **AND** the contest's name and the participants' names are unchanged
