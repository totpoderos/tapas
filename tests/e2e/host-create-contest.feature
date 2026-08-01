Feature: A host creates a contest
  A host starts a new contest from a form: they name it, choose how it is
  attributed and scored, and guard against bias. Saving keeps it as a draft they
  can return to — it does not go live until they publish it. A contest cannot be
  saved without a name. The form is fully keyboard-operable and meets
  accessibility standards (WCAG 2.1 AA).

  Who is taking part is not asked for here. A contest is prepared in two sections
  — its rules and its participants and pairing — and this form is the first of
  them, so it hands over to the second rather than asking for the same people
  twice. A host who is done for now saves and stops; a host carrying on goes
  straight to the people.

  Scenario: A host fills in a new contest and saves it as a draft
    Given a signed-in host on the new-contest form
    When they name the contest, choose how it is scored, and save
    Then the contest is saved as a draft
    And it appears in their contest list marked as a draft

  Scenario: The form does not ask who is taking part
    Given a signed-in host on the new-contest form
    Then there is nowhere on it to add a participant
    And the panel says the people come next, once the contest is saved

  Scenario: Going on takes the host to the people, with the contest already saved
    Given a signed-in host on the new-contest form
    When they name the contest and choose to go on to the people
    Then the contest is saved as a draft
    And they are on its participants and pairing, ready to add somebody
    And what they chose on the form is what the contest being prepared says

  Scenario: Saving and stopping leaves the host at their contests
    Given a signed-in host on the new-contest form
    When they name the contest and save it as a draft
    Then they are back at their contest list
    And the contest is there, marked as a draft

  Scenario: A contest cannot be saved without a name
    Given a signed-in host on the new-contest form
    When they try to save the contest without naming it
    Then they are told a name is required
    And no contest is saved and they stay on the form

  Scenario: A contest cannot be gone on from without a name
    Given a signed-in host on the new-contest form
    When they try to go on to the people without naming the contest
    Then they are told a name is required
    And no contest is saved and they stay on the form

  Scenario: The panel names the two sections while the contest is being set up
    Given a signed-in host on the new-contest form
    Then the panel names its rules as the step they are on
    And it names its participants and pairing as the step after saving
    And those are the same two names the contest carries once it is saved

  Scenario: A host can leave without creating a contest
    Given a signed-in host on the new-contest form
    When they leave the form without saving
    Then they are back at their contest list
    And no new contest was created

  Scenario: The new-contest form is keyboard-operable and accessible
    Given a signed-in host on the new-contest form
    When they complete and submit the form using only the keyboard
    Then the screen has no accessibility violations
    And the contest is saved as a draft
