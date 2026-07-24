Feature: Listing my contests
  A host's contests live in different states at once: some are still being
  prepared, some are live and open for voting, some have had voting closed, and
  some have been revealed. A host can list all of their contests in one place,
  each marked with the state it is in. A host only ever sees their own, and
  listing is refused when no one is signed in.

  Scenario: A host sees their contests across every state, each marked with its state
    Given a signed-in host "ana@example.com"
    And that host is preparing a contest named "Summer Tapas"
    And that host has a live contest named "Balcony Cook-off"
    And that host has a contest named "Winter Feast" whose results have been revealed
    When that host lists their contests
    Then all three contests are listed
    And "Summer Tapas" is marked as being prepared
    And "Balcony Cook-off" is marked as live
    And "Winter Feast" is marked as revealed

  Scenario: A contest whose voting has closed is listed as closed
    Given a signed-in host "ana@example.com"
    And that host has a contest named "Rooftop Rounds" whose voting has closed
    When that host lists their contests
    Then "Rooftop Rounds" is marked as closed

  Scenario: A host with no contests yet gets an empty list
    Given a signed-in host "ana@example.com" with no contests
    When that host lists their contests
    Then no contests are listed

  Scenario: A host only sees their own contests
    Given a signed-in host "ana@example.com" who is preparing a contest named "Ana's Tapas"
    And a second signed-in host "bob@example.com" who has a live contest named "Bob's Cook-off"
    When "ana@example.com" lists their contests
    Then only "Ana's Tapas" is listed

  Scenario: Listing requires being signed in
    Given no one is signed in
    When listing contests is attempted
    Then the attempt is refused as not signed in
