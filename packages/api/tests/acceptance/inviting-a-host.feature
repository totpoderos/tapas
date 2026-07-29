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

  Scenario: An invitation from an administrator never produces another administrator
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    Then the account created is not an administrator

  Scenario: A resent invitation still produces an ordinary host
    Given an invitation was sent to "nuevo@example.com"
    When the administrator resends it
    And the invited person accepts with the new link
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

  Scenario: An administrator sees the invitations and how they stand
    Given an invitation was sent to "nuevo@example.com"
    When the administrator asks to see the invitations
    Then that invitation is listed with the address it was sent to
    And it is shown as pending

  Scenario: An invitation whose time has run out is shown as expired
    Given an invitation was sent to "nuevo@example.com"
    When more than 24 hours pass
    And the administrator asks to see the invitations
    Then that invitation is shown as expired

  Scenario: The listing reveals no link
    Given an invitation was sent to "nuevo@example.com"
    When the administrator asks to see the invitations
    Then no invitation's link appears in the listing

  Scenario: An ordinary host cannot see the invitations
    Given a signed-in host "bob@example.com"
    When that host asks to see the invitations
    Then access is refused as not allowed

  Scenario: A revoked link stops working
    Given an invitation was sent to "nuevo@example.com"
    When the administrator revokes it
    And the invited person tries to accept with a strong password
    Then accepting is refused because the link cannot be used
    And no host account exists for "nuevo@example.com"

  Scenario: A revoked link no longer opens either
    Given an invitation was sent to "nuevo@example.com"
    When the administrator revokes it
    And the invited person opens their link
    Then opening is refused because the link cannot be used

  Scenario: An accepted invitation cannot be revoked
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    And the administrator tries to revoke it
    Then revoking is refused because there is nothing to revoke

  Scenario: An invitation cannot be revoked twice
    Given an invitation was sent to "nuevo@example.com"
    When the administrator revokes it
    And the administrator tries to revoke it again
    Then revoking is refused because there is nothing to revoke

  Scenario: Resending sends a new link to the same address
    Given an invitation was sent to "nuevo@example.com"
    When the administrator resends it
    Then a message is sent to "nuevo@example.com"
    And it carries a different link from the first

  Scenario: The new link works and the old one dies
    Given an invitation was sent to "nuevo@example.com"
    When the administrator resends it
    And the invited person tries to accept with the original link
    Then accepting is refused because the link cannot be used
    And accepting with the new link creates the host account

  Scenario: The new invitation gets its own full window
    Given an invitation was sent to "nuevo@example.com"
    When nearly 24 hours pass and the administrator resends it
    And nearly another 24 hours pass
    And the invited person accepts with the new link
    Then a host account exists for "nuevo@example.com"

  Scenario: An expired invitation can be resent
    Given an invitation was sent to "nuevo@example.com"
    When more than 24 hours pass
    And the administrator resends it
    Then the invited person can accept with the new link

  Scenario: A revoked invitation cannot be resent
    Given an invitation was sent to "nuevo@example.com"
    When the administrator revokes it
    And the administrator tries to resend it
    Then resending is refused because that invitation is finished

  Scenario: An accepted invitation cannot be resent
    Given an invitation was sent to "nuevo@example.com"
    When the invited person accepts with a strong password
    And the administrator tries to resend it
    Then resending is refused because that invitation is finished

  Scenario: A superseded invitation cannot be resent again
    Given an invitation was sent to "nuevo@example.com"
    When the administrator resends it
    And the administrator tries to resend the original invitation again
    Then resending is refused because that invitation is finished

  Scenario: A revoked link is refused exactly like one that never existed
    Given an invitation was sent to "nuevo@example.com"
    When the administrator revokes it
    And the invited person tries to accept with a strong password
    Then the refusal is the same as for a link that never existed
    And the refusal names no email address

  Scenario: A superseded link is refused exactly like one that never existed
    Given an invitation was sent to "nuevo@example.com"
    When the administrator resends it
    And the invited person tries to accept with the original link
    Then the refusal is the same as for a link that never existed

  Scenario: The invitation survives a message that could not be sent
    Given an administrator "ana@example.com" whose mail server will take nothing
    When the administrator invites "nuevo@example.com"
    Then inviting is not refused
    And an invitation for "nuevo@example.com" is pending
    And the administrator is told the message did not go out

  Scenario: A failed handoff offers the link, once
    Given an administrator "ana@example.com" whose mail server will take nothing
    When the administrator invites "nuevo@example.com"
    Then the link is offered to that administrator
    And the invited person can accept with it and become a host

  Scenario: A successful handoff offers no link
    Given an administrator "ana@example.com"
    When the administrator invites "nuevo@example.com"
    Then no link is offered to that administrator

  Scenario: The link is still absent from the stored invitation when sending failed
    Given an administrator "ana@example.com" whose mail server will take nothing
    When the administrator invites "nuevo@example.com"
    Then the stored invitation does not contain the link

  Scenario: A handed-off message is recorded as such
    Given an administrator "ana@example.com"
    When the administrator invites "nuevo@example.com"
    Then the invitation records that its message went out

  Scenario: A message that could not be handed off is recorded as such
    Given an administrator "ana@example.com" whose mail server will take nothing
    When the administrator invites "nuevo@example.com"
    Then the invitation records that its message did not go out

  Scenario: A weak password is refused
    Given an invitation was sent to "nuevo@example.com"
    When the invited person tries to accept with the weak password "short"
    Then accepting is refused because the password is too weak

  Scenario: The invitation still works after a refused password
    Given an invitation was sent to "nuevo@example.com"
    When the invited person tries to accept with the weak password "short"
    And they then accept with a strong password
    Then a host account exists for "nuevo@example.com"
