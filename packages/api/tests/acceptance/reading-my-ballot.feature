Feature: Reading my ballot
  Before scoring, a participant reads their ballot: the dishes open to them —
  their own dish and anyone the anti-bias rules bar them from scoring already
  removed — together with the categories, the score range that applies to them,
  and whether each category must be a strict ranking. Reading a ballot requires
  having claimed a place.

  Scenario: A voter's ballot lists only the dishes open to them
    Given a live contest a participant has joined, scored per person with couples barred
    When that participant reads their ballot
    Then their own dish is not on it
    And their partner's dish is not on it
    And the dishes they may score are on it, with the categories and their score range

  Scenario: Reading a ballot requires having claimed a place
    Given a live contest
    When a ballot is requested with no participant token
    Then it is refused as not signed in
