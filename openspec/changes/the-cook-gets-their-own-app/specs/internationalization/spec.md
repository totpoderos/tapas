## MODIFIED Requirements

### Requirement: A language selector is present on every screen

Each frontend SHALL offer, on every screen, a single labelled control for choosing the interface language. Choosing a language SHALL switch the whole screen at once, with no reload.

The one exception SHALL be the participant app's revealed results, which SHALL carry no header and therefore no selector. That screen is the moment the room looks at one thing together, and the handoff gives its rank numeral the whole top of the phone. A participant reaches it having already read four screens that all offer the control, and their choice is remembered — so the cost is borne only by somebody who opens the results as their first screen, in a language they did not choose, and who must step back one screen to change it. No further exception SHALL be taken without being written here.

#### Scenario: Choosing a language switches the screen

- **WHEN** a visitor reading a screen in English chooses Spanish from the language selector
- **THEN** the whole screen is shown in Spanish without reloading

#### Scenario: The selector is accessible

- **WHEN** a visitor reaches the language selector
- **THEN** it is a labelled control operable by keyboard, announced to assistive technology, with no accessibility violations

#### Scenario: The revealed results carry no selector

- **WHEN** a participant is shown the revealed results
- **THEN** there is no header and no language control on that screen

#### Scenario: The language a participant chose still holds on the results

- **WHEN** a participant who chose Spanish earlier is shown the revealed results
- **THEN** the results are read in Spanish

#### Scenario: The wait still offers the selector

- **WHEN** a participant is waiting for the results to be revealed
- **THEN** the header and its language control are there, as on every other screen
