Feature: Host sessions over the API
  A host works with their contests by calling the API. First they sign in and
  receive a session; that session lets them act. Protected work is refused when
  no one is signed in, and refused differently when the signed-in host is not
  allowed to touch someone else's work. A host can refresh a session that has
  aged out, and can sign out to end it for good.

  Scenario: A host signs in and receives a session
    Given no host is registered with "ana@example.com"
    When a host registers and signs in through the API as "ana@example.com"
    Then the API grants a session

  Scenario: A signed-in host can do protected work
    Given a signed-in host "ana@example.com"
    When that host creates a draft through the API
    Then the draft is created

  Scenario: Protected work is refused when no one is signed in
    Given no one is signed in
    When a draft is requested through the API
    Then the API refuses it as not signed in

  Scenario: A host cannot act on another host's work
    Given a signed-in host "ana@example.com" who owns a draft
    And a second signed-in host "bob@example.com"
    When "bob@example.com" tries to read that draft through the API
    Then the API refuses it as not allowed

  Scenario: A host refreshes a session that has aged out
    Given a signed-in host "ana@example.com" whose session has aged out
    When that host refreshes the session through the API
    Then the API grants a fresh session
    And protected work is allowed again

  Scenario: Signing out ends the session
    Given a signed-in host "ana@example.com"
    When that host signs out through the API
    Then the former session no longer allows protected work

  Scenario: A used-up refresh cannot be replayed
    Given a signed-in host "ana@example.com" whose session has aged out
    When that host refreshes the session through the API
    And someone tries to refresh again with the old, already-used session
    Then the API refuses it as not signed in
