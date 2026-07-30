Feature: A host watches the ending on the panel
  When the results are out, the host is a spectator rather than an announcer:
  they see exactly what everyone else sees, rendered from the same view, so the
  two cannot come to say different things about who won.

  The results exist only once a contest has been revealed. Before that the panel
  says so rather than offering a way to an empty screen, and points at the place
  where revealing actually happens.

  Rank is carried by its number as well as by emphasis, so a leaderboard read
  without seeing the styling still says who came where.

  Scenario: The results are offered once the contest is revealed
    Given a signed-in host whose contest has been revealed
    Then the panel offers the results of that contest
    And going there shows who won

  Scenario: Before the reveal the results are named but not offered
    Given a signed-in host whose contest is still running
    Then the panel names the results but does not offer them
    And it says they come after the reveal

  Scenario: A host who goes there early is told, and pointed where to go
    Given a signed-in host whose contest has not been revealed
    When they ask for its results anyway
    Then they are told the results are not out yet
    And they are offered the way to the control room, where revealing happens

  Scenario: The ending is shown whole
    Given a signed-in host looking at the results of a revealed contest
    Then the winner is named
    And the best in each category is named
    And the leaderboard lists every dish with its total

  Scenario: Rank is not carried by emphasis alone
    Given a signed-in host looking at a leaderboard
    Then each place is numbered
    And the leader is first by number, not only by how it is drawn

  Scenario: The results are the same ones the participants see
    Given a contest that has been revealed
    When the host and a participant both look at who won
    Then they are told the same winner

  Scenario: The results are not another host's to read
    Given a signed-in host asking for the results of a contest they do not own
    Then they are told it is not theirs to see
    And nothing about that contest is shown

  Scenario: The panel says which contest's results these are
    Given a signed-in host looking at a contest's results
    Then the panel names that contest and says the results are where they are
    And the way back to the contest is offered

  Scenario: The results are keyboard-operable and free of accessibility violations
    Given a signed-in host looking at the results
    When they move through the screen using only the keyboard
    Then they can reach the rest of their work without a mouse, showing where focus is
    And the screen has no accessibility violations

  Scenario: The ending does not flash at somebody who asked for stillness
    Given a signed-in host who has asked their device for reduced motion
    When they look at the results
    Then the ending settles without animating

  Scenario: The results read in Spanish
    Given a signed-in host looking at the results
    When they switch the language to Spanish
    Then everything the screen says is in Spanish
    And the dish names are unchanged

  Scenario: The results hold together on a narrow screen
    Given a signed-in host looking at the results on a narrow screen
    Then the screen does not spill sideways
    And it has no accessibility violations
