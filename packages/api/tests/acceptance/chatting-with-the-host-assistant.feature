Feature: Chatting with the host assistant
  A signed-in host can direct their contest by chatting with the assistant in
  plain language. The assistant works out what they want and either asks for more
  detail, carries out a reversible action and reports what it did, or — for an
  action that cannot be undone — asks the host to confirm before doing anything.
  A confirmation only authorises the exact action it was given for. Chatting is
  refused when no one is signed in.

  One message may ask for several things, and all of them happen, in the order
  they were asked for. Two things end a run early and are said plainly rather
  than hidden: something irreversible, which is put to the host on its own, and
  something that could not be done, which stops what would have followed it.

  Scenario: The assistant asks for detail when a request is ambiguous
    Given a signed-in host chatting with the assistant
    When they ask for something the assistant cannot act on without more detail
    Then the assistant replies asking them to clarify
    And nothing about their contest changes

  Scenario: The assistant carries out a reversible action and reports it
    Given a signed-in host chatting with the assistant
    When they ask the assistant to start a new draft called "Summer Tapas"
    Then a draft called "Summer Tapas" is saved for them
    And the assistant reports that it did so

  Scenario: The assistant says what it did in plain language
    Given a signed-in host chatting with the assistant
    When the assistant carries out a reversible action but offers no words of its own
    Then the host is still told, in plain language, what was done

  Scenario: The assistant says when an action could not be carried out
    Given a signed-in host chatting with the assistant
    When an action the assistant tries cannot be carried out
    Then the host is told it did not happen
    And the host is told why

  Scenario: A destructive action is not carried out until the host confirms
    Given a signed-in host with a running contest, chatting with the assistant
    When they ask the assistant to close that contest
    Then the contest is not closed
    And the assistant asks the host to confirm closing it

  Scenario: Confirming carries out the destructive action
    Given a host whom the assistant has asked to confirm closing their running contest
    When the host confirms
    Then the contest is closed

  Scenario: A confirmation authorises only the action it was given for
    Given a host who was asked to confirm closing one running contest
    When that confirmation is used to try to close a different contest
    Then the different contest is not closed
    And the host is asked to confirm that action instead

  Scenario: A confirmed action that fails is reported as failed
    Given a signed-in host chatting with the assistant
    When they confirm a destructive action that cannot be carried out
    Then the host is told it did not happen

  Scenario: Chatting with the assistant requires being signed in
    Given no one is signed in
    When a message is sent to the assistant
    Then it is refused as not signed in

  # A host writes one message and gets one contest and nothing else — no
  # categories, no people, and nothing said about the five things that did not
  # happen. The model proposed all six; only the first was ever carried out.
  Scenario: One message asking for several things gets all of them
    Given a signed-in host chatting with the assistant
    When they ask in one message to create a contest, judge it on two things, and have three people taking part
    Then the contest exists, judged on both, with all three taking part
    And every step is reported, in the order it was asked for

  Scenario: A message asking for a single thing is answered as it always was
    Given a signed-in host chatting with the assistant
    When they ask for one thing alone
    Then it is carried out and reported on its own

  # A confirmation approves the action it names. What a message queued behind
  # that action is not part of what the host agreed to.
  Scenario: Something irreversible is put to the host on its own, and ends the run
    Given a signed-in host with a draft ready to publish
    When they ask in one message to judge it on one more thing and then publish it
    Then the draft is judged on that thing
    And the host is asked to confirm publishing
    And the draft is not published

  Scenario: Nothing asked for after an irreversible action is carried out
    Given a signed-in host with a draft ready to publish
    When they ask in one message to publish it and then rename it
    Then the host is asked to confirm publishing
    And the draft still has the name it had
    And what was not reached is named

  # Later steps lean on earlier ones, so running past a failure turns one honest
  # error into a run of confusing ones.
  Scenario: A step that cannot be carried out stops the ones after it
    Given a signed-in host with a draft judged on "Taste"
    When they ask in one message to judge it on "Taste" again and then on "Presentation"
    Then the repeat is reported as refused, with its reason
    And the draft is not judged on "Presentation"
