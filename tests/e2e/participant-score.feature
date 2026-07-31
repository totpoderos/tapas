Feature: A participant scores the dishes and sends their vote
  In a contest where scores may repeat, a participant gives each dish open to
  them a score, in every category, choosing only from the values allowed — an
  out-of-range score is impossible to enter. They score one dish at a time, and
  can read the whole ballot before sending it: scoring a dish at a time hides
  what has already been done, and a refusal to send says nothing about what is
  missing. They can send only once every dish is scored. Sending is asked for
  once, in a confirmation that holds the keyboard and can be waved away with it —
  a sent vote cannot be undone, so that beat is the only safety net there is.
  Sending locks the vote, and afterwards they are shown what they gave each dish,
  a dish at a time. The screen is mobile-first, keyboard-operable, and meets
  WCAG 2.1 AA.

  Scenario: A participant scores every open dish and sends their vote
    Given a participant in a live contest where scores may repeat
    When they give every dish open to them a score in each category
    Then they can send their vote
    And their vote is locked as sent

  Scenario: Only scores within the allowed range can be given
    Given a participant scoring a dish in a contest with a fixed range
    Then the only scores offered are the ones within that range

  Scenario: Scoring moves one dish at a time
    Given a participant scoring in a live contest
    Then they are shown one dish, and told which dish of how many it is
    And they can move on to the next dish and back to the one before

  Scenario: Coming back to a dish shows what was already given
    Given a participant who has scored a dish and moved on
    When they go back to that dish
    Then the scores they gave it are still shown, and can be changed

  Scenario: Reloading keeps a participant on the same dish
    Given a participant part-way through the dishes
    When they reload
    Then they are shown the same dish they were on

  Scenario: A category not yet scored says so
    Given a participant shown a dish they have not scored
    Then each category still waiting for them says so in words

  Scenario: The whole ballot can be read before sending
    Given a participant who has scored every dish open to them
    When they come to send their vote
    Then they see each dish with the scores they gave it

  Scenario: An incomplete ballot names what is missing and leads there
    Given a participant who has left one category of one dish unscored
    When they come to send their vote
    Then they are told which dish and which category are missing
    And following that takes them to that dish, ready to score it

  Scenario: A vote cannot be sent until every dish is scored
    Given a participant who has left a dish open to them unscored
    Then they cannot send their vote yet

  Scenario: Sending is confirmed, and can be declined
    Given a participant with a complete ballot
    When they ask to send and then decline
    Then their vote is not sent and their ballot is unchanged

  Scenario: The confirmation holds the keyboard while it is open
    Given a participant asked to confirm sending
    When they move through the screen with the keyboard alone
    Then they only ever reach the confirmation's own choices

  Scenario: The confirmation can be dismissed from the keyboard
    Given a participant asked to confirm sending
    When they dismiss the confirmation with the keyboard
    Then their vote is not sent and they are back on their ballot, where they asked from

  Scenario: A sent vote cannot be changed or sent again
    Given a participant who has sent their vote
    Then they cannot change a score or send it again

  Scenario: A sent vote shows what was given, dish by dish
    Given a participant who has sent their vote in a contest with more than one category
    Then they see one row for each dish, with what they gave it
    And what they gave is named as their own, not as the dish's standing

  Scenario: Scoring is keyboard-operable and accessible
    Given a participant scoring in a live contest
    When they score every dish and send their vote using only the keyboard
    Then the screen has no accessibility violations
    And their vote is sent
