Feature: A participant submits their dish
  After joining, a cook registers the dish they brought — a name, and optionally
  a description — and can see the dishes submitted so far. Submitting again
  revises their one dish rather than adding a second; a dish must have a name.
  The screen is mobile-first, fully keyboard-operable, and meets accessibility
  standards (WCAG 2.1 AA).

  Scenario: A cook submits their dish
    Given a participant who has joined a contest
    When they submit their dish with a name
    Then their dish is recorded and shown as theirs

  Scenario: A cook revises their dish rather than adding a second
    Given a participant who has already submitted their dish
    When they submit it again with a new name
    Then their dish shows the new name
    And they still have just one dish

  Scenario: A dish must have a name
    Given a participant who has joined a contest
    When they try to submit their dish without a name
    Then they are told a name is required
    And nothing is submitted

  Scenario: A participant sees the dishes submitted so far
    Given a participant in a contest where another cook has already submitted a dish
    When they open the app
    Then they see that dish among those submitted

  Scenario: Submitting a dish is keyboard-operable and accessible
    Given a participant who has joined a contest
    When they submit their dish using only the keyboard
    Then the screen has no accessibility violations
    And their dish is recorded
