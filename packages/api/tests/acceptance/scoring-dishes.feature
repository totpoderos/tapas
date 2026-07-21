Feature: Scoring dishes
  During a live contest a judge scores the dishes open to them, saving as they
  go and revising freely — nothing is final until they send their vote, which
  is a later step. The contest's rules bound every score: a judge may only
  score dishes open to them, only within the allowed range, and only in the
  contest's categories.

  Scenario: A judge scores a dish that is open to them
    Given a live contest where Ana may score Bob's dish, scored 1 to 5
    When Ana scores Bob's dish 4 for "Taste"
    Then the score is saved

  Scenario: A judge revises a score before sending
    Given a live contest where Ana has scored Bob's dish 4 for "Taste"
    When Ana changes that score to 5
    Then her score for Bob's dish is 5
    And she has only one score for that dish and category

  Scenario: A judge may not score their own dish
    Given a live contest where Ana has her own dish
    When Ana tries to score her own dish for "Taste"
    Then scoring is refused because that dish is not open to her

  Scenario: A score outside the allowed range is refused
    Given a live contest where Ana may score Bob's dish, scored 1 to 5
    When Ana tries to score Bob's dish 9 for "Taste"
    Then scoring is refused because the score is out of range

  Scenario: A score in an unknown category is refused
    Given a live contest where Ana may score Bob's dish, scored 1 to 5
    When Ana tries to score Bob's dish 4 in a category that does not exist
    Then scoring is refused because the category is unknown

  Scenario: A judge sees their own draft scores
    Given a live contest where Ana has scored Bob's dish 4 for "Taste"
    When Ana looks at her scores
    Then her score for Bob's dish is 4

  Scenario: Scoring requires having claimed a place
    Given a live contest
    When a score is saved with no participant token
    Then scoring is refused as not signed in
