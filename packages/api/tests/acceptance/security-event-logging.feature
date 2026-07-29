Feature: Security-event logging
  The API keeps a security log of authentication activity — who signed in, who
  was refused and why, and every personal access token issued, used, or
  revoked. It also records anyone turned away from administrative work, which
  is the only place a reach for privilege would show. Each entry records what
  happened, when, and where it came from. The log is a forensic record, so it
  never stores a password or a full token.

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

  Scenario: A host refused administrative work is recorded
    Given a signed-in host "bob@example.com"
    When that host is refused administrative work
    Then the security log records a refused administrative attempt for that host

  Scenario: A token refused administrative work is recorded
    Given an administrator "ana@example.com" who has issued a personal access token
    When an external client using that token is refused administrative work
    Then the security log records a refused administrative attempt for that administrator

  Scenario: Administrative work that succeeds is not noise in the log
    Given an administrator "ana@example.com"
    When that administrator does administrative work successfully
    Then no refused administrative attempt is recorded

  Scenario: Issuing an invitation is recorded
    Given an administrator "ana@example.com"
    When that administrator invites "nuevo@example.com"
    Then the security log records an invitation issued by that administrator

  Scenario: Accepting an invitation is recorded
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    Then the security log records the invitation accepted

  Scenario: A refused acceptance is recorded
    Given an administrator "ana@example.com"
    When someone tries to accept with a link that no invitation ever had
    Then the security log records a refused acceptance

  Scenario: A refusal for an expired link is recorded as an expiry
    Given an invitation was sent to "nuevo@example.com"
    When more than 24 hours pass and the invited person tries to accept
    Then the security log records a refused acceptance noting the link had expired

  Scenario: A refusal for an unknown link is not recorded as an expiry
    Given an administrator "ana@example.com"
    When someone tries to accept with a link that no invitation ever had
    Then the security log does not describe that refusal as an expiry

  Scenario: The security log never stores the link
    Given an administrator "ana@example.com"
    When that administrator invites "nuevo@example.com"
    Then no security log entry contains that invitation's link
