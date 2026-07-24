Feature: A participant joins a contest
  Someone at the venue joins a live contest with its join code — no account, no
  password — by choosing their own name from the places still open. Once joined
  they are remembered on that device, so reopening the app keeps them in without
  the code again. An unrecognised code is refused, and a place someone else has
  just taken cannot be chosen. Joining is mobile-first, fully keyboard-operable,
  and meets accessibility standards (WCAG 2.1 AA).

  Scenario: A participant joins by choosing their place
    Given a live contest with open places
    When a participant enters its join code and chooses their name
    Then they have joined the contest as that participant

  Scenario: An unrecognised join code is refused
    When a participant enters a join code that no contest has
    Then they are told the code is not recognised
    And they have not joined anything

  Scenario: A place taken since the list loaded cannot be claimed
    Given a participant who has entered a valid code and is choosing a place
    When the place they choose has just been taken by someone else
    Then they are told that place is no longer available

  Scenario: A returning participant is remembered on their device
    Given a participant who has already joined a contest on this device
    When they reopen the app
    Then they are still recognised as that participant, without entering the code

  Scenario: Joining is keyboard-operable and accessible
    Given a live contest with open places
    When a participant joins using only the keyboard
    Then the screen has no accessibility violations
    And they have joined the contest
