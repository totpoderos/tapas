Feature: Reading your drafts and tallies through a connected assistant
  Beyond reading a published contest, a host can have their connected assistant
  read the other things that belong to them: a contest draft they are still
  preparing, and the live tally of a running contest (how many have claimed a
  place, are still scoring, and have sent their votes). As with every tool, the
  assistant acts strictly as that host — it reads only what the host owns — and
  it carries the request through without deciding anything itself.

  Scenario: The assistant reads a draft the host owns
    Given a host with a personal access token and a saved draft
    When the assistant is asked to read that draft with the host's token
    Then the draft is returned

  Scenario: The assistant reads the live tally of the host's contest
    Given a host with a personal access token and a running contest
    When the assistant is asked to read that contest's tally with the host's token
    Then the tally is returned

  Scenario: The assistant cannot read a draft the host does not own
    Given a host with a personal access token, and a draft owned by a different host
    When the assistant is asked to read the other host's draft with the first host's token
    Then the request is refused as not allowed
