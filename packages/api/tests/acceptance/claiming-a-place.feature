Feature: Claiming a place in a contest
  A contest is published with the participants the host listed. To take part, a
  person enters the join code, sees the whole roster — who is still to arrive and
  who has already taken their place — and claims theirs by name. Claiming links
  them to that place, so the scoring rules know who they are. Each place can be
  claimed only once, and only places on the list exist.

  Showing the taken places as well as the open ones is deliberate. It lets a
  person tell "my name has already been taken" apart from "this is the wrong
  contest", and it lets a contest with nothing left explain itself. It also means
  somebody holding a join code learns who has already arrived, which is accepted:
  those are the names the host listed, they are known to everyone in the room,
  nothing else about a person is attached, and the code stops working when the
  contest closes.

  Scenario: The whole roster is shown for a valid code
    Given a live contest whose participants are "María", "Pau" and "Ana"
    When someone looks up the contest by its join code
    Then all three places are returned, and each is marked open or taken

  Scenario: A taken place is shown as taken, and is not offered to be claimed
    Given a live contest where "Ana"'s place is already taken
    When someone looks up the contest by its join code
    Then "Ana"'s place is marked as taken
    And the places still open are marked as open

  Scenario: A contest with no place left still names its roster
    Given a live contest where every place has been taken
    When someone looks up the contest by its join code
    Then the whole roster is returned, with every place marked as taken

  Scenario: A participant claims their place
    Given a live contest that includes a place for "Ana"
    When a person claims "Ana"'s place with the join code
    Then they are recognised as "Ana"
    And they receive a token for that contest

  Scenario: A place already taken cannot be claimed again
    Given a live contest where "Ana"'s place is already taken
    When another person tries to claim "Ana"'s place
    Then the claim is refused because that place is taken

  Scenario: A place that is not on the list cannot be claimed
    Given a live contest that has no place for "Zoe"
    When a person tries to claim "Zoe"'s place with the join code
    Then the claim is refused because there is no such place

  Scenario: An unknown join code is refused
    Given no contest has the join code "GHOST1"
    When someone looks up the contest by code "GHOST1"
    Then the lookup is refused because the code is unknown

  Scenario: A returning participant is recognised by their token
    Given a person who has claimed "Ana"'s place in a live contest
    When they return to that contest with their token, no code given
    Then they are recognised as "Ana"

  Scenario: A participant's token does not grant host access
    Given a person who has claimed a place in a live contest
    When they try to do a host-only action using their token
    Then access is refused because a voter may not do that
