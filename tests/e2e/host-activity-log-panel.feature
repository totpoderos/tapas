Feature: A host reads what has happened to a contest
  Everything done to a contest is recorded: who did it, when, and how it was
  triggered — in the app, by the system, or through a connected tool. The log is
  the same whatever the path, because it is a projection of the contest's own
  events rather than a note each screen remembers to leave.

  How an action was triggered is the point of reading it. A host checking whether
  an assistant closed their contest, or whether they did it themselves, needs that
  told in words rather than by a colour — and needs to be able to narrow the log
  to one source and see only that.

  Actions that cannot be undone record that the host confirmed them, so the log
  answers "did somebody mean to do this?" and not only "did it happen?".

  Scenario: The log lists what has happened, in order, with how each was triggered
    Given a signed-in host looking at the activity log of a contest they have published
    Then every recorded action is listed
    And each says what happened, who did it, when, and how it was triggered

  Scenario: How an action was triggered is said in words
    Given a signed-in host looking at an activity log with actions from more than one source
    Then each action's source is named
    And it is not told by colour alone

  Scenario: A host narrows the log to one source
    Given a signed-in host looking at an activity log with actions taken in the app and by the system
    When they narrow it to what the system did
    Then only the system's actions are listed
    And the ones taken in the app are not

  Scenario: A host widens the log again
    Given a signed-in host who has narrowed the log to one source
    When they ask for all sources again
    Then everything is listed once more

  Scenario: Narrowing to a source with nothing in it says so
    Given a signed-in host looking at an activity log with nothing from a connected tool
    When they narrow it to what a connected tool did
    Then the log says there is nothing from that source
    And it does not look like the contest has no history

  Scenario: An action the host confirmed says so
    Given a signed-in host looking at the activity log of a contest whose voting they closed
    Then the closing is marked as confirmed by them
    And the actions that needed no confirmation are not marked

  Scenario: A contest with no history yet says so
    Given a signed-in host looking at the activity log of a contest nothing has happened to
    Then the log says nothing has happened yet

  Scenario: The log is not another host's to read
    Given a signed-in host asking for the activity log of a contest they do not own
    Then they are told it is not theirs to see
    And nothing about that contest is shown

  Scenario: The panel says which contest's log this is
    Given a signed-in host looking at a contest's activity log
    Then the panel names that contest and says the log is where they are
    And the way back to the contest is offered

  Scenario: The log is keyboard-operable and free of accessibility violations
    Given a signed-in host looking at an activity log with several sources
    When they move through it using only the keyboard
    Then the source can be narrowed and widened without a mouse, showing where focus is
    And the screen has no accessibility violations

  Scenario: The log reads in Spanish
    Given a signed-in host looking at an activity log
    When they switch the language to Spanish
    Then everything the screen says is in Spanish
    And the contest's name is unchanged
