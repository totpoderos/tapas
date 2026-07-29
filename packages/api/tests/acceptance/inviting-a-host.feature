Feature: Inviting a host
  A host account comes into existence when an administrator invites an address
  and the person who holds that inbox opens the link and chooses a password.
  Opening the link proves nothing has been spent — mail scanners open links
  before people do — so only choosing the password creates the account, and
  only once. A link that cannot be used says nothing about why.

  Scenario: An administrator invites an address
    Given an administrator "ana@example.com"
    When the administrator invites "nuevo@example.com"
    Then an invitation for "nuevo@example.com" is pending

  Scenario: An ordinary host cannot invite
    Given a signed-in host "bob@example.com"
    When that host tries to invite "nuevo@example.com"
    Then access is refused as not allowed
    And no invitation exists for "nuevo@example.com"

  Scenario: Inviting requires being signed in
    Given no one is signed in
    When someone tries to invite "nuevo@example.com"
    Then access is refused as not signed in

  Scenario: An address that already has an account cannot be invited
    Given an administrator "ana@example.com"
    And a host "bob@example.com"
    When the administrator invites "bob@example.com"
    Then inviting is refused because that address is already registered

  Scenario: A message is sent to the invited address
    Given an administrator "ana@example.com"
    When the administrator invites "nuevo@example.com"
    Then a message is sent to "nuevo@example.com"
    And it carries a link for that invitation

  Scenario: The stored invitation does not reveal the link
    Given an administrator "ana@example.com"
    When the administrator invites "nuevo@example.com"
    Then the stored invitation does not contain the link

  Scenario: Opening a good link says whom it is for
    Given an invitation was sent to "nuevo@example.com"
    When the invited person opens their link
    Then the invitation is reported as still good
    And it names "nuevo@example.com"

  Scenario: Opening a link does not spend it
    Given an invitation was sent to "nuevo@example.com"
    When the invited person opens their link twice
    And they accept with a strong password
    Then a host account exists for "nuevo@example.com"

  Scenario: The invited person becomes a host and can sign in
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    Then a host account exists for "nuevo@example.com"
    And that person can sign in with that address and password

  Scenario: Accepting never produces an administrator
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    Then the account created is not an administrator

  Scenario: Accepting does not by itself sign the person in
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    Then no session is granted by the acceptance itself

  Scenario: An accepted link cannot be used again
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    And they try to accept with the same link again
    Then accepting is refused because the link cannot be used

  Scenario: An unknown link is refused
    Given an administrator "ana@example.com"
    When someone tries to accept with a link that no invitation ever had
    Then accepting is refused because the link cannot be used

  Scenario: An already-used link is refused the same way
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    And they try to accept with the same link again
    Then the refusal is the same as for a link that never existed

  Scenario: The refusal reveals no address
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    And they try to accept with the same link again
    Then the refusal names no email address

  Scenario: A link still works within the window
    Given an invitation was sent to "nuevo@example.com"
    When nearly 24 hours pass
    And the invited person accepts with a strong password
    Then a host account exists for "nuevo@example.com"

  Scenario: A link no longer accepts once the window has passed
    Given an invitation was sent to "nuevo@example.com"
    When more than 24 hours pass
    And the invited person tries to accept with a strong password
    Then accepting is refused because the link cannot be used
    And no host account exists for "nuevo@example.com"

  Scenario: A link no longer opens once the window has passed
    Given an invitation was sent to "nuevo@example.com"
    When more than 24 hours pass
    And the invited person opens their link
    Then opening is refused because the link cannot be used

  Scenario: An expired link is refused the same way as one that never existed
    Given an invitation was sent to "nuevo@example.com"
    When more than 24 hours pass
    And the invited person tries to accept with a strong password
    Then the refusal is the same as for a link that never existed
    And the refusal names no email address

  Scenario: An expired invitation stays expired
    Given an invitation was sent to "nuevo@example.com"
    When more than 24 hours pass
    And the invited person opens their link and then tries to accept
    Then accepting is still refused because the link cannot be used

  Scenario: A weak password is refused
    Given an invitation was sent to "nuevo@example.com"
    When the invited person tries to accept with the weak password "short"
    Then accepting is refused because the password is too weak

  Scenario: The invitation still works after a refused password
    Given an invitation was sent to "nuevo@example.com"
    When the invited person tries to accept with the weak password "short"
    And they then accept with a strong password
    Then a host account exists for "nuevo@example.com"
