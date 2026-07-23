Feature: A host signs in to the host app
  A host can create an account and sign in to the host app, and stays signed in
  as they move around it and reload. Signing in is fully keyboard-operable and
  meets accessibility standards (WCAG 2.1 AA), on both the sign-up and sign-in
  screens. Bad credentials are refused with a clear, announced error, and the
  host stays where they are.

  Scenario: A returning host signs in
    Given a host who already has an account
    When they sign in with their email and password
    Then they are signed in and see their home page

  Scenario: The wrong password is refused with an announced error
    Given a host who already has an account
    When they try to sign in with the wrong password
    Then they are told the credentials are invalid
    And they remain on the sign-in screen, not signed in

  Scenario: A signed-in host is remembered across a reload
    Given a host who is signed in
    When they reload the app
    Then they are still signed in and see their home page

  Scenario: A signed-in host can sign out
    Given a host who is signed in
    When they sign out
    Then they are returned to the sign-in screen, not signed in

  Scenario: The sign-in screen is keyboard-operable and accessible
    Given the host app is open at the sign-in screen
    When the host fills and submits the form using only the keyboard
    Then the screen has no accessibility violations
    And the sign-in succeeds
