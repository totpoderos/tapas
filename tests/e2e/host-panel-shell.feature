Feature: The panel carries its navigation everywhere
  The host panel is one workspace rather than eight separate screens. Its
  navigation is present wherever a signed-in host goes, so no surface is a dead
  end: from a contest's activity log the assistant is one step away, not a trip
  back through the contest list. The navigation says where the host is, counts
  their contests by state, and scopes itself to a contest when they are working
  inside one.

  The panel is one kind of workspace at a time. A host's panel offers host work
  and no administration; an administrator's offers administration and no host
  work, and they land on the people when they sign in. What it draws authorizes
  nothing either way — the server still decides on every request, and an
  administrator keeps a host's powers there.

  It is a real navigation landmark: skipping to the content lands on the surface
  rather than inside the navigation, everything is reachable by keyboard, and a
  contest's state is read by word and shape, never by colour alone (WCAG 2.1 AA).

  Scenario: The navigation is present on every screen a host can reach
    Given a signed-in host who has a live contest and a draft contest
    When they visit their contests, the assistant, the live contest, the draft, and the live contest's activity log
    Then the panel's navigation is present on each of those screens

  Scenario: A host reaches another surface without going back to their contests
    Given a signed-in host looking at the activity log of their live contest
    When they take the way to the assistant from the navigation
    Then they arrive at the assistant

  Scenario: The navigation says which surface the host is on
    Given a signed-in host looking at the activity log of their live contest
    When they read the navigation
    Then the way to the activity log is marked as the current one
    And the panel names the contest and then the activity log

  Scenario: The navigation counts the host's contests by state
    Given a signed-in host who has two live contests, one draft contest, and one revealed contest
    When they open the host app
    Then the navigation says they have four contests in total
    And it says two are live and one is being prepared

  Scenario: A host with no contests is counted as none
    Given a signed-in host with no contests
    When they open the host app
    Then the navigation says they have none

  Scenario: Inside a contest the navigation is about that contest
    Given a signed-in host who has a live contest
    When they open that contest
    Then the navigation names that contest and says it is live
    And it offers the way to that contest's activity log
    And it offers the way back to all of their contests

  Scenario: The results of a contest that has not been revealed are not offered
    Given a signed-in host who has a live contest
    When they open that contest
    Then the way to its results is shown as not available yet
    And it cannot be taken

  Scenario: An administrator is offered administration and nothing else
    Given a signed-in administrator
    When they open the host app
    Then the navigation offers the way to the people
    And it offers no contests, no assistant, and no activity

  Scenario: An administrator lands on the people when they sign in
    Given an administrator who is not signed in
    When they sign in
    Then they arrive at the people

  Scenario: An administrator asking for a host surface is taken to the people
    Given a signed-in administrator
    When they open the contest list by its address
    Then they arrive at the people instead

  Scenario: A host is offered host work and no administration
    Given a signed-in host who is not an administrator
    When they open the host app
    Then the navigation carries no administrative group
    And no way to the people is offered anywhere on the screen

  Scenario: Hiding the ways in is not what protects the people
    Given a signed-in host who is not an administrator
    When they open the people screen by its address
    Then they are told it is not for them

  Scenario: Nobody signed in gets no navigation
    Given nobody is signed in
    When the sign-in screen is shown
    Then the panel's navigation is not present

  Scenario: Skipping the navigation lands on the surface
    Given a signed-in host who has a live contest
    When they open the host app, move to the first thing offered, and take it
    Then focus is on the surface, past the navigation

  Scenario: The panel is operable by keyboard and free of accessibility violations
    Given a signed-in host who has a live contest and a draft contest
    When they move through the panel using only the keyboard
    Then every way in and every action can be reached, each showing where focus is
    And the screen has no accessibility violations

  Scenario: A contest's state is readable without colour
    Given a signed-in host who has a live contest and a draft contest
    When they open the host app
    Then each contest's state is named in words
    And each state carries a distinct mark beside its word

  Scenario: The navigation reads in Spanish
    Given a signed-in host who has a live contest
    When they switch the language to Spanish
    Then everything the navigation says is in Spanish
    And their contest's name is unchanged

  Scenario: The panel holds together on a narrow screen
    Given a signed-in host who has a live contest
    When they open the host app on a narrow screen
    Then the navigation is reachable without scrolling sideways
    And the screen has no accessibility violations
