Feature: A host creates a contest
  A host starts a new contest from a form: they name it, choose how it is
  attributed and scored, guard against bias, and list who is taking part. Saving
  keeps it as a draft they can return to — it does not go live until they publish
  it. A contest cannot be saved without a name. The form is fully
  keyboard-operable and meets accessibility standards (WCAG 2.1 AA).

  Scenario: A host fills in a new contest and saves it as a draft
    Given a signed-in host on the new-contest form
    When they name the contest, choose how it is scored, add participants, and save
    Then the contest is saved as a draft
    And it appears in their contest list marked as a draft

  Scenario: A contest cannot be saved without a name
    Given a signed-in host on the new-contest form
    When they try to save the contest without naming it
    Then they are told a name is required
    And no contest is saved and they stay on the form

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
