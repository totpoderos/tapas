Feature: Reading the link that joins a contest
  A host handing their contest to a room should not have to read an address out
  and then a code. So a contest a host reads reports, beside its join code, the
  link that joins it: the address where people join, already carrying that
  contest's code, so that following it asks nobody to type anything.

  The link is built from the address this deployment says people join at, so a
  contest read here leads here. It carries that address and the join code, and
  nothing else about the contest — a link is meant to be held up to strangers.

  Background:
    Given people join contests at "https://join.sobremesa.es"

  Scenario: A host reads their contest and is given the link that joins it
    Given a host with a live contest named "Balcony Cook-off"
    When the host reads that contest
    Then the contest reports the link that joins it, as well as its join code
    And that link is the address where people join, carrying that contest's join code

  Scenario: The link carries the contest's own join code
    Given a host with two live contests, "Balcony Cook-off" and "Paella Sunday"
    When the host reads each of them
    Then each contest's link carries its own join code
    And the two links are not the same

  Scenario: The link says nothing else about the contest
    Given a host with a live contest named "Balcony Cook-off" with Ana and Bob taking part
    When the host reads that contest
    Then the link carries the address where people join and the join code, and nothing more
    And the link says nothing of the contest's name, its host, or who is taking part

  Scenario: The link leads to the place this deployment sends people to
    Given people join contests at "https://tapas.example.org"
    And a host with a live contest named "Balcony Cook-off"
    When the host reads that contest
    Then the link that joins it begins with "https://tapas.example.org"

  Scenario: The address is not doubled up when it is given with a trailing slash
    Given people join contests at "https://join.sobremesa.es/"
    And a host with a live contest named "Balcony Cook-off"
    When the host reads that contest
    Then the link that joins it begins with "https://join.sobremesa.es"
    And the link holds no doubled separator

  Scenario: Reading a contest still reports the join code it has always reported
    Given a host with a live contest named "Balcony Cook-off"
    When the host reads that contest
    Then the contest still reports the join code people type in
