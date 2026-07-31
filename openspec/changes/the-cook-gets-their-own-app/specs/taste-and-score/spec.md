## ADDED Requirements

### Requirement: A participant scores one dish at a time

The scoring screen SHALL present one dish at a time, with its categories, and SHALL say how far through the dishes a participant is. A participant SHALL be able to move to the next dish and back to the previous one, and SHALL be able to return to a dish they have already scored and change it while their vote is still a draft.

Which dish a participant is on SHALL be part of where they are, not something the screen alone remembers: reloading, going back, or opening the address directly SHALL put them on the same dish.

#### Scenario: Moving through the dishes

- **WHEN** a participant on the scoring screen finishes a dish and moves on
- **THEN** they are shown the next dish, and told which dish of how many it is

#### Scenario: Going back to an earlier dish

- **WHEN** a participant moves back to a dish they already scored, while their vote is a draft
- **THEN** they are shown that dish with the scores they gave it, and can change them

#### Scenario: Reloading keeps a participant on the same dish

- **WHEN** a participant reloads the scoring screen part-way through the dishes
- **THEN** they are shown the same dish they were on

### Requirement: A score is chosen as one value from the allowed range

Within a category a participant SHALL choose exactly one value from the range allowed to them, and the value recorded SHALL always be one of those values — never a value between them. The choice SHALL be operable by keyboard alone: moving between the allowed values one at a time, and reaching the lowest and highest directly.

The control SHALL announce which value is chosen. Where the allowed range is too wide to label every value at the width available, the ends SHALL be labelled and the chosen value SHALL still be announced.

#### Scenario: Choosing a score by keyboard

- **WHEN** a participant moves through a category's values using the keyboard and settles on one
- **THEN** that value is saved for that dish and category

#### Scenario: A category not yet scored says so

- **WHEN** a participant is shown a category they have not yet scored
- **THEN** it is marked as still needing them, in words and not by colour alone

#### Scenario: Only an allowed value is ever recorded

- **WHEN** a participant chooses a score by any means the screen offers
- **THEN** the value recorded is one of the values allowed to them

### Requirement: A participant reviews the whole ballot before sending

Before sending, a participant SHALL be able to see their whole ballot at once: every dish open to them with the scores they gave it. Where the ballot is not complete, it SHALL name which dish and which category are still missing, and SHALL lead the participant straight to that dish and that category.

Scoring one dish at a time hides what has already been done. A refusal to send, on its own, tells a participant that something is missing without telling them what.

#### Scenario: Reading the whole ballot

- **WHEN** a participant asks to see their ballot before sending
- **THEN** every dish open to them is listed with the scores they gave it

#### Scenario: An incomplete ballot names what is missing

- **WHEN** a participant's ballot is missing a score
- **THEN** the dish and category still missing are named

#### Scenario: The way to the missing score is offered

- **WHEN** a participant follows what the ballot says is missing
- **THEN** they are taken to that dish, with that category ready for them

### Requirement: Sending is confirmed before it happens

A participant SHALL be asked to confirm before their vote is sent, and SHALL be able to decline and return to their ballot unchanged. The confirmation SHALL keep the keyboard within it while it is open, SHALL be dismissable by the keyboard, and SHALL be resolved only by the participant's own choice.

A sent vote cannot be undone, so the confirmation is the only safety net there is.

#### Scenario: Declining leaves the ballot alone

- **WHEN** a participant asked to confirm sending declines
- **THEN** their vote is not sent and their ballot is as it was

#### Scenario: The confirmation can be dismissed from the keyboard

- **WHEN** a participant dismisses the confirmation using the keyboard
- **THEN** their vote is not sent and they are returned to their ballot

## MODIFIED Requirements

### Requirement: A participant can tell that their vote is already in

A participant SHALL be able to find out whether their own vote is still a draft or has already been sent, and that answer SHALL come from what is recorded rather than from what a screen happens to remember — so it holds however they arrive: by a link, by going back, by reloading, or by opening the address directly.

Where a vote has been sent, the participant SHALL be shown that it is sent, together with what they gave each dish, and SHALL NOT be offered any way to change or resend it. What they gave SHALL be shown per dish rather than as one row per score: after sending, the question a participant asks is how they rated each dish, and a list of every dish-and-category pair answers a question nobody asked. Where it is still a draft, they SHALL be able to carry on scoring as before.

#### Scenario: Coming back to scoring after voting

- **WHEN** a participant who has sent their vote returns to the scoring screen
- **THEN** they are shown that their vote is already in, and what they gave each dish

#### Scenario: A sent vote offers nothing to change

- **WHEN** a participant who has sent their vote looks at their scoring screen
- **THEN** nothing there offers to alter a score or to send the vote again

#### Scenario: A draft vote is still editable

- **WHEN** a participant who has not yet sent their vote returns to the scoring screen
- **THEN** they can carry on scoring and send when they are ready

#### Scenario: Reloading does not change the answer

- **WHEN** a participant who has sent their vote reloads the scoring screen
- **THEN** it still shows the vote as sent, exactly as before the reload
