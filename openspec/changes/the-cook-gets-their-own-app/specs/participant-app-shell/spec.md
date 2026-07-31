## ADDED Requirements

### Requirement: The participant app has a visual language of its own

The participant app SHALL present its own visual language, separate from the host panel's, and SHALL NOT depend on the host panel's styling to do so. The two apps SHALL share the shape of the data they both show and SHALL NOT share the drawing of it.

This is a decision, not a consequence: the two audiences use the product differently — a host administers from a desk, a cook stands in a room holding a plate — and each app is free to change its appearance without the other's agreement.

#### Scenario: Restyling the host panel leaves the participant app alone

- **WHEN** the host panel's appearance is changed
- **THEN** every participant screen is drawn exactly as it was before

#### Scenario: The participant app carries its own appearance

- **WHEN** a participant opens any screen of the app
- **THEN** it is drawn from the participant app's own definitions, not from the host panel's

### Requirement: The participant app is shown in one presentation only

The participant app SHALL present a single light appearance to every participant, whatever their device prefers, and SHALL NOT offer a control for changing it.

A participant is at a venue for one evening on a phone they did not configure for this. The appearance is chosen for legibility in that room, not deferred to a preference set for something else.

#### Scenario: A device that prefers a dark appearance still gets the light one

- **WHEN** a participant whose device asks for a dark appearance opens the app
- **THEN** they are shown the app's light appearance

#### Scenario: No appearance control is offered

- **WHEN** a participant looks at any screen of the app
- **THEN** nothing there offers to change the app's appearance

### Requirement: Every screen carries the same frame

Every participant screen SHALL carry the same header, naming the product and — once a participant has joined — where they are. Every screen a joined participant can reach SHALL carry the same ways onward, in the same place.

#### Scenario: The header is on every screen

- **WHEN** a participant is on any screen of the app
- **THEN** the same header is there

#### Scenario: A joined participant is never without the ways onward

- **WHEN** a joined participant is on any screen open to them
- **THEN** the ways onward to the other steps are there, in the same place as on every other screen

### Requirement: A failure is reported where it happened

When something a participant did fails, they SHALL be told at the thing that failed — the field, the row, or the panel they acted on — rather than only at the top of the screen.

A message above a title that no longer applies asks a participant to work out for themselves what it refers to, at the moment they are least able to.

#### Scenario: An unrecognised join code is reported at the field

- **WHEN** a participant enters a join code no contest has
- **THEN** they are told so at the join-code field itself

#### Scenario: A ballot that cannot be sent says which dish is missing

- **WHEN** a participant tries to send a ballot that is not complete
- **THEN** they are told which dish and which category are still missing, and can go straight there

### Requirement: The accessibility floor holds on every screen

Every participant screen SHALL be operable by keyboard alone, SHALL reflow to a 320px-wide viewport without horizontal scrolling or loss of content, and SHALL neutralise its motion when the device asks for reduced motion. Colour SHALL never be the only carrier of meaning.

Interactive controls SHALL offer a touch target of at least 44px in their smaller dimension. The one exception SHALL be the steps of the score track, which are narrower: they are at least 44px in their larger dimension, are correctable by dragging without lifting, and are separately operable by keyboard. No further exception SHALL be taken without being written here.

#### Scenario: Every screen survives a narrow viewport

- **WHEN** any participant screen is shown in a 320px-wide viewport
- **THEN** its content is all reachable without scrolling sideways

#### Scenario: Motion is neutralised on request

- **WHEN** a participant's device asks for reduced motion
- **THEN** no screen animates

#### Scenario: A state is never carried by colour alone

- **WHEN** a place is taken, a category is unscored, or a participant has still to vote
- **THEN** each is said in words as well as shown by colour
