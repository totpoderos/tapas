Feature: Administrative access
  Some work is reserved to an administrator — seeing which host accounts exist
  is the first of it. An ordinary host is turned away as not allowed, which is
  a different answer from the one someone gets when nobody is signed in. A
  personal access token carries the powers of a host and never those of an
  administrator, so a leaked token can never reach this surface.

  Scenario: An administrator sees the list of host accounts
    Given an administrator "ana@example.com"
    And a host "bob@example.com"
    When the administrator asks to see the host accounts
    Then every existing host account is listed
    And each one shows whether it is an administrator

  Scenario: A host is refused administrative work
    Given a signed-in host "bob@example.com"
    When that host asks to see the host accounts
    Then access is refused as not allowed

  Scenario: Being refused tells the host nothing about what exists
    Given an administrator "ana@example.com"
    And a signed-in host "bob@example.com"
    When that host asks to see the host accounts
    Then the refusal reveals no host account

  Scenario: Administrative work is refused when no one is signed in
    Given no one is signed in
    When the host accounts are asked for
    Then access is refused as not signed in

  Scenario: An administrator's token cannot do administrative work
    Given an administrator "ana@example.com" who has issued a personal access token
    When an external client uses that token to ask to see the host accounts
    Then access is refused as not allowed

  Scenario: An administrator's token can still do a host's work
    Given an administrator "ana@example.com" who has issued a personal access token
    When an external client uses that token to create a draft
    Then the draft is created for that administrator
