Feature: Host authentication
  A host registers with an email and a password, then logs in to act on their
  contests. The password is never stored as given. Logging in is refused for a
  wrong password or an unknown email — the same way, so no one can tell which.
  Repeated failures lock the account for a while.

  Scenario: A host registers and can log in
    Given no host is registered with "ana@example.com"
    When a host registers with email "ana@example.com" and a strong password
    Then the host account is created
    And the host can log in with that email and password
    And a session is issued

  Scenario: The password is never stored in the clear
    Given a registered host with email "ana@example.com"
    Then the stored credentials do not reveal the password

  Scenario: Logging in with the wrong password is refused
    Given a registered host with email "ana@example.com"
    When the host tries to log in with the wrong password
    Then logging in is refused as invalid credentials

  Scenario: Logging in with an unknown email is refused the same way
    Given no host is registered with "nobody@example.com"
    When someone tries to log in with "nobody@example.com"
    Then logging in is refused as invalid credentials

  Scenario: Registering a taken email is refused
    Given a registered host with email "ana@example.com"
    When a host registers with email "ana@example.com" and a strong password
    Then registering is refused because the email is already taken

  Scenario: A weak password is refused
    Given no host is registered with "ana@example.com"
    When a host registers with email "ana@example.com" and the weak password "short"
    Then registering is refused because the password is too weak

  Scenario: The account locks after repeated failures
    Given a registered host with email "ana@example.com"
    When the host fails to log in 5 times
    Then logging in is locked, even with the correct password
