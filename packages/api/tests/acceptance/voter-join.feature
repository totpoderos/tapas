Feature: Voter join
  A participant joins a live contest using its join code and a display name —
  no account needed. Joining hands back a remember-me token scoped to that one
  contest, so they can return without the code. That token is no good anywhere
  else: not for another contest, and not for anything a host does.

  Scenario: A participant joins a live contest with a valid code
    Given a live contest with join code "TAPAS1"
    When a participant joins with that code and the display name "Marcos"
    Then the join succeeds
    And the participant receives a token for that contest

  Scenario: Joining with an unknown code is refused
    Given no contest has the join code "GHOST1"
    When a participant tries to join with code "GHOST1" and the display name "Marcos"
    Then the join is refused because the code is unknown

  Scenario: A returning participant is recognised by their token, without the code
    Given a participant who already joined a live contest as "Marcos"
    When they return to that contest with their token, no code given
    Then they are recognised as "Marcos" without rejoining

  Scenario: A participant's token does not grant access to a different contest
    Given a participant who joined one live contest as "Marcos"
    And a second, unrelated live contest
    When they try to use their token on the second contest
    Then access is refused because the token is not for that contest

  Scenario: A participant's token does not grant host access
    Given a participant who joined a live contest as "Marcos"
    When they try to do a host-only action on that contest using their token
    Then access is refused because a voter may not do that
