## ADDED Requirements

### Requirement: A participant can tell that their vote is already in

A participant SHALL be able to find out whether their own vote is still a draft or has already been sent, and that answer SHALL come from what is recorded rather than from what a screen happens to remember — so it holds however they arrive: by a link, by going back, by reloading, or by opening the address directly.

Where a vote has been sent, the participant SHALL be shown that it is sent, together with the scores they gave, and SHALL NOT be offered any way to change or resend it. Where it is still a draft, they SHALL be able to carry on scoring as before.

#### Scenario: Coming back to scoring after voting

- **WHEN** a participant who has sent their vote returns to the scoring screen
- **THEN** they are shown that their vote is already in, and the scores they gave

#### Scenario: A sent vote offers nothing to change

- **WHEN** a participant who has sent their vote looks at their scoring screen
- **THEN** nothing there offers to alter a score or to send the vote again

#### Scenario: A draft vote is still editable

- **WHEN** a participant who has not yet sent their vote returns to the scoring screen
- **THEN** they can carry on scoring and send when they are ready

#### Scenario: Reloading does not change the answer

- **WHEN** a participant who has sent their vote reloads the scoring screen
- **THEN** it still shows the vote as sent, exactly as before the reload

### Requirement: The scoring screen is never a dead end

From the scoring screen a participant SHALL always be able to reach the other steps open to them — the dishes, and the results — whichever way they arrived at it. A participant SHALL NOT depend on the browser's own controls to leave a screen.

Moving between steps SHALL be theirs to choose: a participant who goes back to look at an earlier step SHALL be shown that step, and SHALL NOT be sent onward without asking.

#### Scenario: Moving on from scoring

- **WHEN** a participant is on the scoring screen
- **THEN** they can reach the dishes and the results from it

#### Scenario: Going back is respected

- **WHEN** a participant who has sent their vote goes back from the results to the scoring screen
- **THEN** they are shown the scoring screen, and are not returned to the results without asking

#### Scenario: Arriving directly is no different

- **WHEN** a participant opens the scoring screen's address directly
- **THEN** the same ways onward are open to them as if they had followed a link
