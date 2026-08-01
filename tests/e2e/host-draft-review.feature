Feature: A host gets a contest ready to go live
  A contest being prepared is where a host settles who is taking part, who is
  paired with whom, and what would stop it from being published. They change it,
  save it, and publish it when it is ready.

  Publishing is checked, not assumed. The screen says what is still missing before
  it can go live, so a host is never left pressing publish and reading a refusal to
  find out — and the panel says the same thing where they can see it without
  scrolling.

  Saving and publishing live in the panel's header, and saving says so when it has
  happened, because a change that vanishes into a form with no acknowledgement is a
  change a host will make twice.

  Settling the rules and settling the people are two different jobs, so they are two
  sections rather than one long screen. They are two views of one contest, not two
  copies of it: moving between them neither saves nor loses anything, and one save
  stores whatever was changed on either.

  Scenario: The rules and the people are two sections
    Given a signed-in host looking at a contest being prepared
    Then its rules and its participants and pairing are offered as two ways in
    And the panel names the contest and says it has not been published

  Scenario: Each section holds its own part of the contest
    Given a signed-in host looking at the rules of a contest being prepared
    Then they can change what it is called, its format, its scoring categories and its score range
    And the roster and the pairings are not on that section
    When they go to its participants and pairing
    Then they can add and remove people, and pair them
    And the contest's name, its format and its scoring are not on that section

  Scenario: The panel says which section the host is on
    Given a signed-in host looking at the participants and pairing of a contest being prepared
    Then the panel marks that section as the current one
    And it does not mark the rules as current

  Scenario: An unsaved change survives moving between the sections
    Given a signed-in host looking at the rules of a contest being prepared
    When they change its name, go to its participants and pairing, and come back
    Then the name they typed is still there
    And they were not asked about unsaved work on the way

  Scenario: Moving between the sections does not save
    Given a signed-in host looking at the rules of a contest being prepared
    When they change its name and go to its participants and pairing without saving
    Then the contest being prepared is still called what it was called before

  Scenario: One save stores a change made on each section
    Given a signed-in host looking at a contest being prepared
    When they change its name on its rules, add a person on its participants and pairing, and save once
    Then the contest being prepared has both the new name and the new person
    And they are told it was saved

  Scenario: Saving and publishing are offered on both sections
    Given a signed-in host looking at a contest being prepared
    Then saving and publishing are offered in the panel's header on its rules
    And they are offered in the panel's header on its participants and pairing

  Scenario: What is still missing is said on both sections
    Given a signed-in host looking at a contest being prepared, scored per couple
    And two of its participants have no partner
    Then its rules list what is ready and what is not, and say two participants still need a partner
    And its participants and pairing say the same

  Scenario: A ready contest is published from whichever section the host is on
    Given a signed-in host looking at the rules of a contest being prepared that is complete
    When they publish it
    Then it is live
    And they are taken to its control room, where its join code is waiting

  Scenario: Publishing an incomplete contest leaves the host where they were
    Given a signed-in host looking at the participants and pairing of a contest being prepared that is not ready
    When they try to publish it
    Then they are told why it cannot go live
    And it is still a contest being prepared
    And they are still on its participants and pairing

  Scenario: A pairing survives a change of format
    Given a signed-in host looking at the participants and pairing of a contest being prepared
    When they pair two participants, change the contest's format away and back, and save
    Then the two are still partners

  Scenario: There is nowhere to bar a pair by hand
    Given a signed-in host looking at the participants and pairing of a contest being prepared
    Then nothing there offers to bar a pair from scoring each other

  Scenario: Both sections are free of accessibility violations
    Given a signed-in host looking at a contest being prepared with people on it
    When they move through each of its two sections using only the keyboard
    Then every field and action can be reached and taken, each showing where focus is
    And neither section has any accessibility violations

  Scenario: Both sections read in Spanish
    Given a signed-in host looking at a contest being prepared
    When they switch the language to Spanish
    Then everything both sections say is in Spanish, including their names in the panel
    And the contest's name and the participants' names are unchanged

  Scenario: The screen says what is still missing before publishing
    Given a signed-in host looking at a contest being prepared, scored per couple
    And two of its participants have no partner
    Then the screen lists what is ready and what is not
    And it says two participants still need a partner
    And the panel says so too, without scrolling

  Scenario: A contest nobody is taking part in is not ready to publish
    Given a signed-in host looking at a contest being prepared that nobody is taking part in
    Then the checklist says nobody is taking part yet
    And it does not say the contest is ready to publish

  Scenario: A contest one person is taking part in says why a second is needed
    Given a signed-in host looking at a contest being prepared that one person is taking part in
    Then the checklist says at least two people are needed
    And it says that is because nobody may score their own dish
    And it does not say the contest is ready to publish

  Scenario: The people are counted once there are enough of them
    Given a signed-in host looking at a contest being prepared that two people are taking part in
    Then the checklist counts the people taking part
    And it does not list the people as something still missing

  Scenario: A contest just started does not claim to be ready
    Given a signed-in host who has named a new contest and gone on to its participants and pairing
    Then nobody is taking part in it yet
    And the checklist says so, rather than saying it is ready to publish

  Scenario: A contest with nothing missing says it is ready
    Given a signed-in host looking at a contest being prepared that is complete
    Then the screen says everything needed is in place
    And nothing is listed as still missing

  Scenario: A participant without a partner is marked where they are
    Given a signed-in host looking at a contest being prepared, scored per couple
    And one of its participants has no partner
    Then that participant is marked as needing one
    And the ones who have a partner are not

  Scenario: Pairing is only asked about when it matters
    Given a signed-in host looking at a contest being prepared, scored per person
    And one of its participants has no partner
    Then nobody is marked as needing a partner, because scoring is per person

  Scenario: A host pairs two people
    Given a signed-in host looking at a contest being prepared with two unpaired people
    When they make each the other's partner and save
    Then the two are paired
    And neither is marked as needing a partner any more

  Scenario: A host adds somebody to the contest
    Given a signed-in host looking at a contest being prepared
    When they add a person by name and save
    Then that person is on its roster

  Scenario: A host takes somebody off the contest
    Given a signed-in host looking at a contest being prepared with two people
    When they remove one of them and save
    Then only the other is on its roster

  Scenario: A host bars two people from scoring each other
    Given a signed-in host looking at a contest being prepared where chosen pairs cannot score each other
    When they bar two of the participants from scoring each other and save
    Then neither of the two can score the other
    And the pair is listed as barred

  Scenario: A host lifts a bar
    Given a signed-in host looking at a contest being prepared with a barred pair
    When they lift the bar and save
    Then the pair is no longer listed as barred
    And each can score the other again

  Scenario: Saving says that it saved
    Given a signed-in host looking at a contest being prepared
    When they change its name and save
    Then they are told it was saved
    And the new name is what the contest being prepared is called

  Scenario: A contest cannot be saved without a name
    Given a signed-in host looking at a contest being prepared
    When they clear its name and try to save
    Then they are told a name is needed
    And nothing is changed

  Scenario: Publishing takes an incomplete contest nowhere
    Given a signed-in host looking at a contest being prepared that is not ready
    When they try to publish it
    Then they are told why it cannot go live
    And it is still a contest being prepared

  Scenario: Publishing a ready contest takes it live
    Given a signed-in host looking at a contest being prepared that is complete
    When they publish it
    Then it is live
    And they are taken to its control room, where its join code is waiting

  Scenario: Saving and publishing are in the panel's header
    Given a signed-in host looking at a contest being prepared
    Then saving and publishing are offered in the panel's header
    And the panel names the contest and says it is being prepared

  Scenario: The screen is keyboard-operable and free of accessibility violations
    Given a signed-in host looking at a contest being prepared with people on it
    When they move through it using only the keyboard
    Then every field and action can be reached and taken, each showing where focus is
    And the screen has no accessibility violations

  Scenario: The screen reads in Spanish
    Given a signed-in host looking at a contest being prepared
    When they switch the language to Spanish
    Then everything the screen says is in Spanish
    And the contest's name and the participants' names are unchanged
