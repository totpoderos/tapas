Feature: Submitting a dish
  During a live contest each cook registers the dish they brought — a name, and
  optionally a description. A cook's dish is their place in the contest, so they
  can only submit or change that one, and they may revise it while the contest
  runs. When partners share a dish, either of them may submit it. Everyone
  taking part can see the dishes submitted so far.

  Scenario: A cook submits their dish
    Given a live contest where "Ana" has claimed her place
    When Ana submits a dish named "Patatas bravas"
    Then her dish is recorded as "Patatas bravas"

  Scenario: A cook revises their dish rather than adding a second
    Given a live contest where "Ana" has submitted "Patatas bravas"
    When Ana submits her dish again as "Patatas bravas picantes"
    Then her dish is now "Patatas bravas picantes"
    And she still has only one dish

  Scenario: A dish must have a name
    Given a live contest where "Ana" has claimed her place
    When Ana submits a dish with no name
    Then submitting is refused because a name is required

  Scenario: Submitting a dish requires having claimed a place
    Given a live contest
    When a dish is submitted with no participant token
    Then submitting is refused as not signed in

  Scenario: Everyone taking part can see the dishes submitted so far
    Given a live contest where "Ana" has submitted "Patatas bravas"
    When a participant lists the contest's dishes
    Then "Patatas bravas" is among them

  Scenario: Partners share one dish, and either may submit it
    Given a live contest where "Ana" and "Marcos" are partners sharing a dish
    When Marcos submits their dish as "Tortilla"
    Then the couple's single dish is recorded as "Tortilla"
    And Ana sees the same dish as hers
