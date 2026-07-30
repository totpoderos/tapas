Feature: A host works through the assistant, on the panel
  The assistant is a way of asking for the same things the screens do, in plain
  language. It runs nothing the host could not run themselves, as nobody but the
  host, and everything it does is recorded as having come through it — so the
  activity log can answer "did I do this, or did something acting for me?".

  A conversation is read as a conversation: what the host asked stands apart from
  what the assistant answered, by shape and side rather than by colour alone.

  Nothing irreversible happens on the assistant's say-so. A destructive action is
  proposed and waits, and what the host is agreeing to is named in the asking.
  What was carried out is then said plainly, in words, with what it left behind.

  Scenario: The conversation is on the panel, with the panel still around it
    Given a signed-in host who has opened the assistant
    Then the panel says the assistant is where they are
    And the ways to the rest of their work are still offered

  Scenario: What was asked and what was answered are told apart
    Given a signed-in host who has asked the assistant something
    Then their own words are shown as theirs
    And the assistant's answer is shown as the assistant's
    And the two are not told apart by colour alone

  Scenario: A reversible action is carried out and said plainly
    Given a signed-in host talking to the assistant
    When they ask for something that can be undone
    Then it is carried out
    And the conversation says what was done

  Scenario: A destructive action waits to be agreed to
    Given a signed-in host talking to the assistant about a contest they are running
    When they ask for something that cannot be undone
    Then nothing is done yet
    And they are asked to agree, and told which action it is
    And the contest is untouched until they do

  Scenario: Agreeing carries the action out and says what it left
    Given a signed-in host who has been asked to agree to closing their contest
    When they agree
    Then the closing is carried out
    And the conversation says so, and says the contest is now closed

  Scenario: Declining leaves everything as it was
    Given a signed-in host who has been asked to agree to closing their contest
    When they decline
    Then nothing is done
    And the contest is still running

  Scenario: What the assistant did is recorded as the assistant's
    Given a signed-in host who has closed a contest through the assistant
    When they read that contest's activity log
    Then the closing is recorded as having come through a connected tool
    And it is recorded as confirmed by them

  Scenario: An action the assistant could not carry out is not dressed as success
    Given a signed-in host talking to the assistant
    When they ask for something the API refuses
    Then they are told it did not happen, and why
    And the conversation does not say it was done

  Scenario: A waiting agreement cannot be cleared out from under itself
    Given a signed-in host who has been asked to agree to something irreversible
    Then clearing the conversation is out of reach until they settle it
    And settling it puts clearing back within reach

  Scenario: A host clears the conversation
    Given a signed-in host with a conversation behind them
    When they clear it
    Then the conversation is empty
    And they are told it was cleared
    And it is still empty after they come back to it

  Scenario: The assistant is keyboard-operable and free of accessibility violations
    Given a signed-in host talking to the assistant
    When they move through the screen using only the keyboard
    Then they can write and send without a mouse, showing where focus is
    And an agreement can be given or declined without a mouse
    And the screen has no accessibility violations

  Scenario: The assistant reads in Spanish
    Given a signed-in host looking at the assistant
    When they switch the language to Spanish
    Then everything the screen says is in Spanish
    And what they typed is unchanged

  Scenario: The conversation holds together on a narrow screen
    Given a signed-in host talking to the assistant on a narrow screen
    Then the screen does not spill sideways
    And the composer is still reachable and usable
