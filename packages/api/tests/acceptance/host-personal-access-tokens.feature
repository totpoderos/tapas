Feature: Host personal access tokens
  A signed-in host can issue a personal access token for an external tool —
  like the MCP server — to act as them without handing over their password.
  The token works exactly like being signed in, until the host revokes it.
  Only the host who owns a token may revoke it.

  Scenario: A signed-in host issues a personal access token
    Given a signed-in host "ana@example.com"
    When that host issues a personal access token
    Then a usable token is returned

  Scenario: The token lets an external client act as that host
    Given a signed-in host "ana@example.com" who has issued a personal access token
    When an external client uses that token to create a draft
    Then the draft is created for that host

  Scenario: A revoked token no longer works
    Given a signed-in host "ana@example.com" who has issued a personal access token
    When the host revokes that token
    And an external client tries to use the revoked token
    Then access is refused as not signed in

  Scenario: A host cannot revoke another host's token
    Given a signed-in host "ana@example.com" who has issued a personal access token
    And a second signed-in host "bob@example.com"
    When "bob@example.com" tries to revoke ana's token
    Then access is refused as not allowed

  Scenario: Issuing a token requires being signed in
    Given no one is signed in
    When someone tries to issue a personal access token
    Then access is refused as not signed in
