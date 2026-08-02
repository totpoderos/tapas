Feature: Directing a contest from the chat panel
  A host can open a chat panel in their app and tell the assistant, in plain
  language, what to do. The panel shows not just the assistant's words but the
  actions it takes and their results, so the host is always in the loop. A
  reversible action is carried out straight away; an action that cannot be undone
  is held behind a confirmation card the host must accept before anything happens.
  Cancelling changes nothing. The panel is fully keyboard-operable and meets
  accessibility standards (WCAG 2.1 AA).

  Scenario: The assistant answers when it needs more detail
    Given a signed-in host with the chat panel open
    When they ask for something the assistant needs more detail about
    Then the assistant replies asking them to clarify
    And no action is taken

  Scenario: The assistant carries out a reversible action and shows what it did
    Given a signed-in host with the chat panel open
    When they ask the assistant to start a new draft called "Summer Tapas"
    Then the panel shows the assistant carried the action out
    And the new draft exists

  Scenario: The assistant lists the host's contests by name
    Given a signed-in host with a contest named "Tapas Night" and the chat panel open
    When they ask the assistant to list their contests
    Then the panel shows "Tapas Night" among their contests

  Scenario: The assistant shows a contest's participants by name
    Given a signed-in host with a contest named "Tapas Night" that Ana and Bob are taking part in, and the chat panel open
    When they ask the assistant who is in "Tapas Night"
    Then the panel shows Ana and Bob taking part

  Scenario: The assistant adds a participant to a draft by name
    Given a signed-in host with a draft named "Tapas Night" that Ana and Bob are taking part in, and the chat panel open
    When they ask the assistant to add "Carmen" to "Tapas Night"
    Then the panel shows Ana, Bob and Carmen taking part

  Scenario: The conversation is kept when leaving the panel and coming back
    Given a signed-in host who has exchanged a message with the assistant
    When they leave the chat panel for their contest list and return to it
    Then the earlier conversation is still there

  Scenario: A destructive action is held behind a confirmation card
    Given a signed-in host with a running contest and the chat panel open
    When they ask the assistant to close that contest
    Then the panel shows a confirmation card for closing it
    And the contest is not closed

  Scenario: Confirming the card carries out the action
    Given a host shown a confirmation card for closing their running contest
    When they accept the confirmation
    Then the contest is closed
    And the panel shows it was done

  Scenario: Cancelling the card changes nothing
    Given a host shown a confirmation card for closing their running contest
    When they cancel the confirmation
    Then the contest is still running
    And no action was taken

  # A host who reuses a name must be able to act on the right contest without
  # ever meeting an internal id. Asking is the only way to tell them apart, and
  # asking has to happen for every action, not only for the reads that could ask
  # before.
  Scenario: The panel asks which contest is meant when an action names one two of them share
    Given a signed-in host with two running contests both named "Tapas Night", and the chat panel open
    When they ask the assistant to close "Tapas Night" and accept the confirmation
    Then the panel shows both contests and asks which one they mean
    And neither contest is closed

  # Distinct from an action that was tried and refused: one is a mistyped name,
  # the other is a thing that could not be done. A host reads them differently
  # and the panel must not blur them.
  Scenario: The panel says plainly when an action names no contest at all
    Given a signed-in host with a running contest named "Tapas Night", and the chat panel open
    When they ask the assistant to close "Sunday Roast" and accept the confirmation
    Then the panel says no contest has that name
    And it is not shown as an action that failed
    And the contest named "Tapas Night" is still running

  Scenario: The chat panel is keyboard-operable and accessible
    Given a signed-in host with a running contest and the chat panel open
    When they ask to close the contest and accept the confirmation using only the keyboard
    Then the confirmation card is reachable and focus-managed
    And the screen has no accessibility violations
