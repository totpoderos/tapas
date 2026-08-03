## ADDED Requirements

### Requirement: A scoring category keeps its identity while a contest is prepared

Something a contest is judged on SHALL stay the same thing for as long as the
contest is being prepared, however it was added and however often the host saves.
Saving the rules SHALL NOT give a category a new identity, renaming a category
SHALL NOT make it a different one, and adding or removing a category SHALL leave
the identity of every other one alone.

A category's identity is the system's to keep, not the host's to state and not
the screen's to derive from the order rows happen to be in. A host who adds a
category through the assistant and then saves the rules on the form has done two
ordinary things, and the contest SHALL be judged on the same set of things
afterwards as before.

#### Scenario: Saving the rules unchanged changes nothing about what is judged

- **WHEN** a signed-in host opens the rules of a contest they are preparing and saves them without editing anything
- **THEN** the contest is judged on the same things, each still the same one it was

#### Scenario: Renaming a category leaves it the same thing

- **WHEN** a signed-in host renames one of the things their contest is judged on
- **THEN** it is the same thing under a new name, and the others are untouched

#### Scenario: A category added through the assistant survives a save on the form

- **WHEN** a host adds something to be judged on through their assistant, then opens the rules of that contest and saves them
- **THEN** the contest is still judged on that thing, and it is still the same one

#### Scenario: Removing a category leaves the rest alone

- **WHEN** a signed-in host removes one of the things their contest is judged on and saves
- **THEN** the contest is judged on the remaining ones, each still the same one it was
