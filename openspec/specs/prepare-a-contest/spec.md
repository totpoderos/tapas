# prepare-a-contest Specification

## Purpose
How a host works on a contest before it goes live: that its rules and its people
are two sections rather than one screen, what belongs to each, that edits made in
one survive moving to the other, that one save stores the whole thing from either,
and that saving, publishing and what is still missing are offered wherever the host
is standing. Creating a contest is the first of those two sections, so it settles
the rules and hands the people over rather than asking for them twice.
## Requirements
### Requirement: A contest being prepared has two sections
A contest that has not yet gone live SHALL be prepared in two sections rather than on one screen. One section SHALL hold its **rules** — what it is called, its format, the scoring categories, the score range, and whether scores must be unique within a category. The other SHALL hold its **participants and pairing** — who is taking part and who is paired with whom. Everything a host could settle on the one screen SHALL be settled on one of the two, and nothing SHALL appear on both.

#### Scenario: The rules are settled in their own section
- **WHEN** a signed-in host opens the rules of a contest they are preparing
- **THEN** they can change what it is called, its format, its scoring categories, its score range, and whether scores must be unique within a category
- **AND** the roster and the pairings are not on that section

#### Scenario: The people are settled in their own section
- **WHEN** a signed-in host opens the participants and pairing of a contest they are preparing
- **THEN** they can add and remove people, and pair them as partners where the format allows it
- **AND** the contest's name, its format and its scoring are not on that section

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

Participants without a partner SHALL be reported as missing only under the format where couples cook together, since that is the only format where having no partner is a fault rather than a choice.

#### Scenario: What is still missing is said on either section
- **WHEN** a signed-in host is preparing a contest where couples cook together, two of whose participants have no partner
- **THEN** both its rules and its participants and pairing list what is ready and what is not
- **AND** both say two participants still need a partner
- **AND** the panel says so too, without scrolling

#### Scenario: A participant without a partner is not reported as missing under the other formats
- **WHEN** a signed-in host is preparing a contest where partners are kept apart, two of whose participants have no partner
- **THEN** the checklist does not report those participants as something still missing

#### Scenario: A contest is published from the section the host is on
- **WHEN** a signed-in host on the rules of a complete contest they are preparing publishes it
- **THEN** it is live
- **AND** they are taken to its control room, where its join code is waiting

#### Scenario: Publishing an incomplete contest from either section takes it nowhere
- **WHEN** a signed-in host on the participants and pairing of an incomplete contest they are preparing tries to publish it
- **THEN** they are told why it cannot go live
- **AND** it is still a contest being prepared
- **AND** they are still on the section they were on

### Requirement: Creating a contest settles its rules and hands over to its people
The form that starts a contest SHALL be the first of the two sections and SHALL NOT ask who is taking part, so that the same people are not asked for twice. It SHALL offer both a way to save and stop and a way to go on to the participants and pairing of the contest it just saved. Going on SHALL save first, so the host never carries unsaved rules into the next section.

#### Scenario: The form does not ask who is taking part
- **WHEN** a signed-in host is starting a new contest
- **THEN** there is nowhere on the form to add a participant

#### Scenario: Going on saves the contest and lands on its people
- **WHEN** a signed-in host names a new contest, chooses how it is scored, and chooses to go on to the people
- **THEN** the contest is saved as a contest being prepared
- **AND** they are on its participants and pairing
- **AND** what they chose on the form is what the contest being prepared says

#### Scenario: Saving and stopping leaves the host at their contests
- **WHEN** a signed-in host names a new contest and saves it as a draft
- **THEN** they are back at their list of contests
- **AND** the contest is there, marked as being prepared

#### Scenario: Going on is refused without a name, exactly as saving is
- **WHEN** a signed-in host tries to go on to the people without naming the contest
- **THEN** they are told a name is required
- **AND** nothing is saved and they stay on the form

### Requirement: The two sections are named the same from the first form onwards
While a contest is being set up, the panel SHALL name the same two sections it names once the contest is saved — its rules and its participants and pairing — marking the rules as the step the host is on and the participants as the one that follows saving. A host SHALL therefore meet one pair of names, not two.

#### Scenario: The panel names both steps while the contest is being set up
- **WHEN** a signed-in host is starting a new contest
- **THEN** the panel names its rules as the step they are on
- **AND** it names its participants and pairing as the step that follows saving

#### Scenario: The step that cannot be reached yet is not offered as if it were
- **WHEN** a signed-in host is starting a new contest they have not saved
- **THEN** the way to its participants and pairing is shown as not available yet
- **AND** it cannot be taken

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

### Requirement: The publish checklist says whether enough people are taking part
The checklist SHALL say whether a contest being prepared has enough people to go live, because a contest with nobody taking part, and a contest with exactly one person, are both refused when published. It SHALL NOT report a contest as ready while either is true. Where only one person is taking part, the checklist SHALL say why a second is needed rather than only that one is.

The checklist remains a prediction from the draft's own content. Whether every judge can score something depends on the contest's format and its pairings together, and stays the server's answer — only what is certain from the count alone is said here.

#### Scenario: A contest nobody is taking part in is not ready
- **WHEN** a signed-in host is preparing a contest that nobody is taking part in
- **THEN** the checklist says nobody is taking part yet
- **AND** it does not say the contest is ready to publish

#### Scenario: A contest one person is taking part in is not ready, and says why
- **WHEN** a signed-in host is preparing a contest that exactly one person is taking part in
- **THEN** the checklist says at least two people are needed
- **AND** it says that is because nobody may score their own dish
- **AND** it does not say the contest is ready to publish

#### Scenario: The people are counted once there are enough of them
- **WHEN** a signed-in host is preparing a contest that two or more people are taking part in
- **THEN** the checklist counts the people taking part
- **AND** it does not report the people as something still missing

#### Scenario: A contest reached from the form that starts it does not claim to be ready
- **WHEN** a signed-in host names a new contest and goes on to its participants and pairing, where nobody has been added yet
- **THEN** the checklist says nobody is taking part yet
- **AND** it does not say the contest is ready to publish

### Requirement: A contest is prepared under one of three formats

A contest SHALL have exactly one **format**, chosen from three, and that one choice SHALL settle both who cooks a dish and who may not score it. There SHALL be no second rule to set alongside it and no combination of settings for a host to reason about: every format is a contest that can be held, and no format leaves anything about scoring undecided.

The three SHALL be:

- **everyone on their own** — each person cooks their own dish, and everybody scores every dish but their own;
- **everyone on their own, partners kept apart** — each person cooks their own dish, a partner is optional, and whoever has one does not score their partner's dish, while whoever has none scores everybody;
- **couples cook together** — each couple cooks one dish between them, everybody has a partner, and nobody scores the dish their own couple cooked.

Each format SHALL be offered saying what happens under it, not naming a rule, so that a host reads three contests rather than three settings.

#### Scenario: The rules offer one format, described as what happens

- **WHEN** a signed-in host opens the rules of a contest they are preparing
- **THEN** they are offered exactly one choice of format, with the three formats to choose from
- **AND** each says what it means for who cooks and who scores
- **AND** there is no separate choice of what guards against bias

#### Scenario: Everyone on their own leaves only a person's own dish out

- **WHEN** a contest where everyone is on their own goes live
- **THEN** every participant may score every dish except the one they cooked

#### Scenario: A partner's dish is not theirs to score

- **WHEN** a contest where everyone is on their own with partners kept apart goes live, in which one pair are partners and one participant has no partner
- **THEN** neither partner may score the other's dish
- **AND** the participant without a partner may score every dish but their own

#### Scenario: A couple cooks one dish and neither of them scores it

- **WHEN** a contest where couples cook together goes live
- **THEN** each couple has one dish between them
- **AND** neither member of a couple may score that dish
- **AND** each of them may score every other couple's dish

### Requirement: The partner offered follows the contest's format

Who may be paired with whom SHALL be asked only where a partner does something. Under **everyone on their own** no partner SHALL be asked for, since none would change anything. Under **partners kept apart** a partner SHALL be offered and SHALL be optional. Under **couples cook together** a partner SHALL be required, and anybody without one SHALL be marked as still wanting one, in words and not by colour alone.

Pairings already recorded SHALL survive a change of format: choosing a format that has no use for them SHALL neither discard them nor warn about them, and choosing a format that uses them again SHALL put them back to work without anybody entering them a second time.

#### Scenario: No partner is asked for when nobody is kept apart

- **WHEN** a signed-in host opens the participants of a contest they are preparing where everyone is on their own
- **THEN** there is nowhere to give a participant a partner

#### Scenario: A partner is optional when partners are kept apart

- **WHEN** a signed-in host opens the participants of a contest they are preparing where partners are kept apart
- **THEN** they can give a participant a partner or leave them without one
- **AND** a participant left without one is not marked as wanting anything

#### Scenario: A partner is required when couples cook together

- **WHEN** a signed-in host opens the participants of a contest they are preparing where couples cook together, one of whose participants has no partner
- **THEN** that participant is marked, in words, as still needing a partner

#### Scenario: Pairings survive a change of format

- **WHEN** a signed-in host who has paired two participants changes the contest they are preparing to one where everyone is on their own, and then back
- **THEN** the two are still partners
- **AND** they were not warned about the pairing on the way

