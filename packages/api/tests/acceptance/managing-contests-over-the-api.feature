Feature: Managing contests over the API
  A signed-in host drives a contest's whole early life through the API: saving
  a draft, seeing it among their drafts, renaming or discarding it, and
  publishing it into a live contest that participants can then join. Every one
  of these is refused when no one is signed in, and a host may only ever act on
  their own work.

  Scenario: A host takes a contest from draft to live, and it can be joined
    Given a signed-in host "ana@example.com"
    When that host saves a complete draft and publishes it through the API
    Then a live contest with a join code exists
    And a participant can join that contest with the code

  Scenario: A host sees only their own drafts through the API
    Given a signed-in host "ana@example.com" with a saved draft
    And a second signed-in host "bob@example.com" with a saved draft
    When "ana@example.com" lists their drafts through the API
    Then only "ana@example.com"'s draft is listed

  Scenario: A host renames a draft through the API
    Given a signed-in host "ana@example.com" with a saved draft named "Summer Tapas"
    When that host renames the draft to "Summer Tapas Final" through the API
    Then the stored draft is named "Summer Tapas Final"

  Scenario: A host discards a draft through the API
    Given a signed-in host "ana@example.com" with a saved draft
    When that host discards the draft through the API
    Then the draft no longer appears among their drafts

  Scenario: A host reads their own published contest through the API
    Given a signed-in host "ana@example.com" who has published a contest
    When that host reads the contest through the API
    Then the contest's details are returned

  Scenario: A host cannot publish another host's draft through the API
    Given a signed-in host "ana@example.com" who owns a draft
    And a second signed-in host "bob@example.com"
    When "bob@example.com" tries to publish that draft through the API
    Then the API refuses it as not allowed

  Scenario: Publishing requires being signed in
    Given a draft exists
    And no one is signed in
    When publishing that draft is attempted through the API
    Then the API refuses it as not signed in
