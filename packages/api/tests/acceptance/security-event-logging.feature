Feature: Security-event logging
  The API keeps a security log of authentication activity — who signed in, who
  was refused and why, and every personal access token issued, used, or
  revoked. Each entry records what happened, when, and where it came from. The
  log is a forensic record, so it never stores a password or a full token.

  Scenario: A successful sign-in is recorded
    Given a registered host "ana@example.com"
    When that host signs in through the API
    Then the security log records a successful sign-in for that host

  Scenario: A refused sign-in is recorded with its reason
    Given a registered host "ana@example.com"
    When a sign-in is attempted for "ana@example.com" with the wrong password
    Then the security log records a refused sign-in noting the credentials were invalid

  Scenario: A refused sign-in for an unknown account is still recorded
    Given no host is registered with "nobody@example.com"
    When a sign-in is attempted for "nobody@example.com"
    Then the security log records a refused sign-in for an unknown account

  Scenario: The security log never stores the attempted password
    Given a registered host "ana@example.com"
    When a sign-in is attempted for "ana@example.com" with the wrong password
    Then no security log entry contains the attempted password

  Scenario: Issuing a personal access token is recorded
    Given a signed-in host "ana@example.com"
    When that host issues a personal access token
    Then the security log records that a token was issued for that host

  Scenario: Using a personal access token is recorded
    Given a signed-in host "ana@example.com" who has issued a personal access token
    When an external client acts as that host using the token
    Then the security log records that the token was used

  Scenario: The security log never stores a full token
    Given a signed-in host "ana@example.com"
    When that host issues a personal access token
    Then no security log entry contains the full token
