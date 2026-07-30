Feature: A host sets up a new contest
  Setting up a contest means choosing how it will be scored: how dishes are
  credited, what stops people scoring their own side, what each dish is judged on,
  and the band scores fall in.

  Only a name is required to save. Everything else can be filled in now or later,
  and the whole rule space is checked when the contest is published — so saving is
  cheap and a half-decided contest is a normal thing to have. The screen says so,
  because a host who thinks they must finish will not start.

  Saving and cancelling live in the panel's header, where the actions that apply to
  the whole surface belong, and the panel says where this sits in getting a contest
  going.

  Scenario: A contest can be saved with nothing but a name
    Given a signed-in host setting up a new contest
    When they give it a name and save it
    Then it is saved as a contest being prepared
    And they are taken back to their contests, where it appears

  Scenario: A contest cannot be saved without a name
    Given a signed-in host setting up a new contest
    When they try to save it without a name
    Then they are told a name is needed
    And nothing is saved

  Scenario: The screen says that only a name is required
    Given a signed-in host setting up a new contest
    Then the screen says only a name is required to save
    And that everything else is checked when the contest is published

  Scenario: A host chooses how dishes are credited
    Given a signed-in host setting up a new contest
    When they choose that each couple is scored together
    And they give it a name and save it
    Then the contest being prepared is scored per couple

  Scenario: A host chooses what stops people scoring their own side
    Given a signed-in host setting up a new contest
    When they choose that couples cannot score each other
    And they give it a name and save it
    Then the contest being prepared bars couples from scoring each other

  Scenario: A host chooses what each dish is judged on
    Given a signed-in host setting up a new contest
    When they add a category called Presentation
    And they give it a name and save it
    Then the contest being prepared is judged on Presentation as well

  Scenario: A host takes a category back off
    Given a signed-in host setting up a new contest
    When they remove the category it started with
    Then it is no longer listed among what dishes are judged on

  Scenario: A host fixes the band scores fall in
    Given a signed-in host setting up a new contest
    When they choose a fixed band and set it from one to five
    And they give it a name and save it
    Then the contest being prepared uses a fixed band from one to five

  Scenario: A host leaves the band to be worked out
    Given a signed-in host setting up a new contest
    Then the band is worked out automatically unless they fix it
    And no lowest or highest score is asked for while it is

  Scenario: A host lists who is taking part
    Given a signed-in host setting up a new contest
    When they add two people and give it a name and save it
    Then the contest being prepared has both of them on its roster

  Scenario: Cancelling leaves nothing behind
    Given a signed-in host setting up a new contest who has filled some of it in
    When they cancel
    Then they are back at their contests
    And nothing new was saved

  Scenario: The panel says where this sits in getting a contest going
    Given a signed-in host setting up a new contest
    Then the panel shows setting it up as where they are
    And it shows reviewing and publishing as what comes after saving
    And reviewing cannot be reached until there is something to review

  Scenario: Saving fails without losing what was filled in
    Given a signed-in host who has filled in a contest that cannot be saved
    When they try to save it
    Then they are told it could not be saved
    And everything they filled in is still there

  Scenario: The screen is keyboard-operable and free of accessibility violations
    Given a signed-in host setting up a new contest
    When they move through it using only the keyboard
    Then every choice and action can be reached and taken, each showing where focus is
    And the screen has no accessibility violations

  Scenario: The screen reads in Spanish
    Given a signed-in host setting up a new contest
    When they switch the language to Spanish
    Then everything the screen says is in Spanish
