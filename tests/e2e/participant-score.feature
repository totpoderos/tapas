Feature: A participant scores the dishes and sends their vote
  In a contest where scores may repeat, a participant gives each dish open to
  them a score, in every category, choosing only from the values allowed — an
  out-of-range score is impossible to enter. They can send their vote only once
  every dish is scored; sending locks it, and it cannot be changed or sent again.
  The screen is mobile-first, keyboard-operable, and meets WCAG 2.1 AA.

  Scenario: A participant scores every open dish and sends their vote
    Given a participant in a live contest where scores may repeat
    When they give every dish open to them a score in each category
    Then they can send their vote
    And their vote is locked as sent

  Scenario: Only scores within the allowed range can be given
    Given a participant scoring a dish in a contest with a fixed range
    Then the only scores offered are the ones within that range

  Scenario: A vote cannot be sent until every dish is scored
    Given a participant who has left a dish open to them unscored
    Then they cannot send their vote yet

  Scenario: A sent vote cannot be changed or sent again
    Given a participant who has sent their vote
    Then they cannot change a score or send it again

  Scenario: Scoring is keyboard-operable and accessible
    Given a participant scoring in a live contest
    When they score every dish and send their vote using only the keyboard
    Then the screen has no accessibility violations
    And their vote is sent
