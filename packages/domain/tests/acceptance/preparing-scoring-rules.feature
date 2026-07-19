Feature: Preparing a contest's scoring rules
  Preparing a contest works out two things from the host's configuration and
  the participants: who may score which dish, and what scores each judge may
  give. A judge may never score their own dish. These rules are fixed once the
  contest is prepared.

  # --- The three committed variants (proposal.md) ---

  Scenario: Strict variant — per person, couples barred, ranked scores
    Given a contest scored per person
    And couples may not score each other
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

  Scenario: Joint variant — per couple, fixed range, repeats allowed
    Given a contest scored per couple
    And couples may not score each other
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
      | G    | H       |
      | H    | G       |
      | I    |         |
      | J    |         |
    When the contest is prepared for scoring
    Then there are 6 dishes, one per couple and one per single
    And A and B share one dish
    And A may score every dish except A and B's shared dish
    And A may give each category a score from 1 to 10

  Scenario: Permissive variant — per person, fixed range, repeats allowed
    Given a contest scored per person
    And couples may not score each other
    And scores in a category may repeat
    And the score range is fixed from 1 to 10
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
      | I    |         |
    When the contest is prepared for scoring
    Then there are 3 dishes, one per person
    And A may score every dish except A's own and B's
    And A may give each category a score from 1 to 10

  # --- Anti-bias rules in isolation ---

  Scenario: No anti-bias — everyone scores every dish but their own
    Given a contest scored per person
    And there is no anti-bias rule
    And the participants are:
      | name | partner |
      | A    |         |
      | B    |         |
      | C    |         |
    When the contest is prepared for scoring
    Then A may score every dish except A's own

  Scenario: Arbitrary no-score pairs
    Given a contest scored per person
    And these people may not score each other:
      | one | other |
      | A   | C     |
    And the participants are:
      | name | partner |
      | A    |         |
      | B    |         |
      | C    |         |
    When the contest is prepared for scoring
    Then A may score every dish except A's own and C's
    And B may score every dish except B's own

  # --- Rejected configurations ---

  Scenario: A partner reference with no matching person is rejected
    Given a contest scored per person
    And the participants are:
      | name | partner |
      | A    | Z       |
    When the contest is prepared for scoring
    Then preparing the contest is rejected because a partner is missing

  Scenario: A judge who can score no dishes is rejected
    Given a contest scored per person
    And couples may not score each other
    And the participants are:
      | name | partner |
      | A    | B       |
      | B    | A       |
    When the contest is prepared for scoring
    Then preparing the contest is rejected because a judge could score nothing
