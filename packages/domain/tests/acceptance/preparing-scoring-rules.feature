Feature: Preparing a contest's scoring rules
  Preparing a contest works out two things from its format and its participants:
  who may score which dish, and what scores each judge may give. A judge may
  never score their own dish. These rules are fixed once the contest is prepared.

  A contest has one format, and it is the whole answer to who cooks and who may
  not score whom. There are three, and nothing is set beside them.

  # --- Everyone on their own ---

  Scenario: Everyone on their own scores every dish but their own
    Given a contest where everyone is on their own
    And scores in a category may repeat
    And the score range is fixed from 1 to 10
    And the participants are:
      | name | partner |
      | A    |         |
      | B    |         |
      | C    |         |
    When the contest is prepared for scoring
    Then there are 3 dishes, one per person
    And A may score every dish except A's own
    And A may give each category a score from 1 to 10

  Scenario: Partners recorded under this format keep nobody apart
    Given a contest where everyone is on their own
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
      | C    |         |
    When the contest is prepared for scoring
    Then there are 3 dishes, one per person
    And A may score every dish except A's own
    And B may score every dish except B's own

  # --- Everyone on their own, partners kept apart ---

  Scenario: A partner's dish is not theirs to score, and the range follows
    Given a contest where everyone is on their own with partners kept apart
    And scores in a category must all be different
    And the score range adjusts to how many dishes a judge can score
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
      | C    | D       |
      | D    | C       |
      | E    | F       |
      | F    | E       |
      | G    | H       |
      | H    | G       |
      | I    |         |
      | J    |         |
    When the contest is prepared for scoring
    Then there are 10 dishes, one per person
    And A may score every dish except A's own and B's
    And A may give each category a score from 1 to 8
    And I may score every dish except I's own
    And I may give each category a score from 1 to 9

  Scenario: Somebody without a partner is welcome and scores everybody
    Given a contest where everyone is on their own with partners kept apart
    And the score range is fixed from 1 to 10
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
      | I    |         |
    When the contest is prepared for scoring
    Then there are 3 dishes, one per person
    And A may score every dish except A's own and B's
    And I may score every dish except I's own

  # --- Couples cook together ---

  Scenario: A couple cooks one dish and neither of them scores it
    Given a contest where couples cook together
    And scores in a category may repeat
    And the score range is fixed from 1 to 10
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
      | C    | D       |
      | D    | C       |
      | E    | F       |
      | F    | E       |
    When the contest is prepared for scoring
    Then there are 3 dishes, one per couple
    And A and B share one dish
    And A may score every dish except A and B's shared dish
    And B may score every dish except A and B's shared dish
    And A may give each category a score from 1 to 10

  Scenario: Keeping a couple apart needs no rule of its own here
    Given a contest where couples cook together
    And the score range adjusts to how many dishes a judge can score
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
      | C    | D       |
      | D    | C       |
    When the contest is prepared for scoring
    Then there are 2 dishes, one per couple
    And A may give each category a score from 1 to 1
    And A and B may score exactly the same dishes

  # --- Rejected configurations ---

  Scenario: A partner reference with no matching person is rejected
    Given a contest where everyone is on their own
    And the participants are:
      | name | partner |
      | A    | Z       |
    When the contest is prepared for scoring
    Then preparing the contest is rejected because a partner is missing

  Scenario: A partnership only one of them claims is rejected
    Given a contest where everyone is on their own with partners kept apart
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    |         |
      | C    |         |
    When the contest is prepared for scoring
    Then preparing the contest is rejected because a partnership is not reciprocal

  Scenario: A judge who can score no dishes is rejected
    Given a contest where everyone is on their own with partners kept apart
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
    When the contest is prepared for scoring
    Then preparing the contest is rejected because a judge could score nothing

  Scenario: Couples cooking together with somebody unpartnered is rejected
    Given a contest where couples cook together
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
      | C    | D       |
      | D    | C       |
      | E    |         |
    When the contest is prepared for scoring
    Then preparing the contest is rejected because a participant has no partner
