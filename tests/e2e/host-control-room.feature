Feature: A host runs a live contest from its control room
  Once a contest is live the host stops editing it and starts running it. The
  control room is where that happens: the code people join with, how far along the
  voting is, the rules the contest is being played by, what has happened to it
  lately, and the two actions that move it on.

  Both of those actions are one-way. Closing cannot be reopened and revealing
  cannot be undone, so each asks first and the screen says as much before either
  is taken. Deleting is further away still, in a place of its own.

  The tally keeps itself up to date while the host watches, because a host at a
  venue is watching it rather than reloading it.

  Scenario: The control room shows the join code and offers to copy it
    Given a signed-in host looking at their live contest
    Then the code people join it with is shown
    And a way to copy it is offered

  Scenario: A revealed contest no longer shows a join code
    Given a signed-in host looking at their revealed contest
    Then no join code is shown, because nobody can still join

  Scenario: The control room shows how far along the voting is
    Given a signed-in host whose live contest has four people on its roster
    And two of them have joined, one of whom has sent their vote
    When they open its control room
    Then it says two of four have joined
    And it says one has sent their vote and one is still scoring
    And how far along it is can be read in words, not only from a bar

  Scenario: The control room shows the rules the contest is being played by
    Given a signed-in host whose live contest scores each person on their own
    And couples cannot score each other
    And it is judged on three categories, scored from one to ten, each score used once
    When they open its control room
    Then it says each person is scored on their own
    And it says couples cannot score each other
    And it names the three categories
    And it says the scores run from one to ten
    And it says a score is used only once in a category

  Scenario: The control room shows what has happened lately, and the way to all of it
    Given a signed-in host looking at their live contest
    Then the last few things that happened to it are shown
    And a way to the full activity log is offered

  Scenario: Closing asks first, and says it cannot be undone
    Given a signed-in host looking at their live contest
    When they ask to close the voting
    Then they are asked to confirm
    And they are told no more votes can be sent afterwards and it cannot be reopened

  Scenario: Backing out of closing leaves the contest live
    Given a signed-in host who has asked to close the voting
    When they back out
    Then the contest is still live
    And no vote has been stopped

  Scenario: Closing is carried out once confirmed
    Given a signed-in host who has asked to close the voting
    When they confirm
    Then the contest is closed
    And revealing becomes available

  Scenario: Revealing is shown but not available until the voting has closed
    Given a signed-in host looking at their live contest
    Then revealing is shown as not yet available
    And it cannot be taken

  Scenario: Revealing asks first, and says it cannot be undone
    Given a signed-in host looking at their closed contest
    When they ask to reveal the results
    Then they are asked to confirm
    And they are told the winners become visible to everyone and it cannot be undone

  Scenario: Once revealed, the results are the way onward
    Given a signed-in host looking at their revealed contest
    Then neither closing nor revealing is offered any more
    And a way to the results is offered

  Scenario: Deleting is kept apart from the rest
    Given a signed-in host looking at their live contest
    Then deleting is offered in a place of its own, marked as dangerous
    And it says what deleting would take away

  Scenario: The tally keeps up without the host reloading
    Given a signed-in host watching their live contest
    When somebody joins and sends their vote
    Then the tally follows, without the host reloading
    And the screen says it is keeping itself up to date

  Scenario: The control room is keyboard-operable and free of accessibility violations
    Given a signed-in host looking at their live contest
    When they move through the screen using only the keyboard
    Then every action can be reached and taken, each showing where focus is
    And the screen has no accessibility violations

  Scenario: The control room reads in Spanish
    Given a signed-in host looking at their live contest
    When they switch the language to Spanish
    Then everything the screen says is in Spanish
    And the contest's name and its join code are unchanged
