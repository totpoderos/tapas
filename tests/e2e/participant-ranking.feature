Feature: A participant ranks the dishes in a strict-ranking contest
  In a contest where each category is a strict ranking, a participant gives every
  dish open to them a distinct rank — the same rank cannot be given to two dishes,
  by construction. They can send their vote once every dish is ranked; sending
  locks it. The screen is mobile-first, keyboard-operable, and meets WCAG 2.1 AA.

  Scenario: A participant ranks every dish and sends their vote
    Given a participant in a live strict-ranking contest
    When they give each dish open to them a distinct rank in every category
    Then they can send their vote
    And their vote is locked as sent

  Scenario: A rank given to a second dish swaps, so each is used once
    Given a participant ranking the dishes in a category
    When they give a dish a rank another dish already holds
    Then the two dishes swap ranks, so every rank is still used exactly once

  Scenario: A vote cannot be sent until every dish is ranked
    Given a participant who has not yet ranked every dish
    Then they cannot send their vote yet

  Scenario: Ranking is keyboard-operable and accessible
    Given a participant ranking in a live strict-ranking contest
    When they rank every dish and send their vote using only the keyboard
    Then the screen has no accessibility violations
    And their vote is sent
