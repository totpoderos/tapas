Feature: A host hands the join code over by scanning
  At a venue, reading a join code out to a room is slow and error-prone. The
  control room can show it as a scannable code instead, so people can point a
  phone at it.

  Scanning it opens the contest ready to join, code and all, so nobody types
  anything. It is offered alongside copying, not instead of it, and the code stays
  printed beside the image — a scan can fail, a phone may have no camera, and
  somebody may be joining from a laptop across the table.

  It carries where people join and the join code, and nothing else. A join code is
  meant to be handed to strangers; anything more about the contest is not.

  Scenario: The host shows the join code as a scannable code
    Given a signed-in host looking at their live contest
    When they ask to show the join code as a scannable code
    Then a scannable code appears
    And it is described as the scannable code for that join code

  Scenario: The scannable code carries the way into the contest
    Given a signed-in host who is showing the join code as a scannable code
    Then what it carries is where people join, with that contest's join code
    And it is not the bare join code, which would still have to be typed

  Scenario: Scanning it opens the contest ready to join
    Given a signed-in host who is showing the join code as a scannable code
    When somebody at the venue follows what the scannable code carries
    Then the joining screen opens with that contest's places to choose from
    And nobody is asked to type the join code

  Scenario: The code stays readable beside the scannable version
    Given a signed-in host who is showing the join code as a scannable code
    Then the join code is still printed where it was
    And copying it is still offered

  Scenario: Showing can be undone
    Given a signed-in host who is showing the join code as a scannable code
    When they ask to hide it again
    Then the scannable code is gone
    And the join code is still printed

  Scenario: A contest whose results are out offers no scannable code
    Given a signed-in host looking at their revealed contest
    Then no join code is shown, because nobody can still join
    And no scannable code is offered

  Scenario: The scannable code is offered without being asked for first
    Given a signed-in host looking at their live contest
    Then a way to show the join code as a scannable code is offered
    And no scannable code is shown until they ask for it

  Scenario: The scannable code can be operated by keyboard
    Given a signed-in host looking at their live contest
    When they reach the way to show the scannable code using only the keyboard and take it
    Then the scannable code appears
    And whether it is showing is conveyed to assistive technology

  Scenario: The scannable code stays scannable in the dark theme
    Given a signed-in host who is showing the join code as a scannable code
    When they switch to the dark theme
    Then the scannable code is still dark marks on a light ground
    And it is not inverted to match the theme, because a scanner may refuse that

  Scenario: Showing the scannable code introduces no accessibility violations
    Given a signed-in host who is showing the join code as a scannable code
    Then the screen has no accessibility violations

  Scenario: The scannable code reads in Spanish
    Given a signed-in host looking at their live contest
    When they switch the language to Spanish and ask to show the scannable code
    Then everything the screen says about it is in Spanish
    And the join code itself is unchanged
