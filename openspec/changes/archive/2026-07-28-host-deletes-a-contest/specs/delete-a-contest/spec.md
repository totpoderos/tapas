## ADDED Requirements

### Requirement: A host deletes a contest they own

A host SHALL be able to delete a contest they own at any point in its life — while it is still a draft, while it is running, once it has closed, and after its results are out. Deleting SHALL destroy the contest together with everything held about it: who was on its roster, what dishes were entered, and every score and vote cast in it. After deleting, the contest SHALL no longer appear among the host's contests, and SHALL be unreachable by its join code, by its name, and by any means the host had of reaching it before.

Deleting SHALL be refused as not-allowed for a contest owned by a different host, refused as no-such-contest when there is no such contest, and refused as not-signed-in when no one is signed in. Deleting a contest that is already gone SHALL be refused as no-such-contest rather than reported as a fresh deletion.

#### Scenario: A host deletes a contest that has not started

- **WHEN** a host deletes a contest of theirs that is still being prepared
- **THEN** it is gone from their contests, and asking for it again finds nothing

#### Scenario: A host deletes a contest that is running

- **WHEN** a host deletes a contest of theirs that is running, with places claimed and votes already cast
- **THEN** it is gone, and so is every dish, score and vote that was cast in it

#### Scenario: A host deletes a contest whose results are out

- **WHEN** a host deletes a contest of theirs whose results have already been revealed
- **THEN** it is gone, and its results can no longer be read by anyone

#### Scenario: The join code is released

- **WHEN** a host deletes a running contest and someone then tries to join with the code it was using
- **THEN** they are told there is no such contest

#### Scenario: A host cannot delete another host's contest

- **WHEN** a host tries to delete a contest owned by a different host
- **THEN** it is refused as not allowed, and that contest is untouched

#### Scenario: Deleting requires being signed in

- **WHEN** a contest is deleted with no one signed in
- **THEN** it is refused as not signed in

#### Scenario: Deleting the same contest twice

- **WHEN** a host deletes a contest of theirs and then deletes it again
- **THEN** the second attempt is told there is no such contest

### Requirement: A deletion leaves a tombstone and nothing more

Deleting a contest SHALL destroy its recorded history along with the contest itself, and SHALL leave exactly one entry in its place recording that the contest was deleted: by which host, when, through which path, and that it was confirmed. That entry SHALL NOT carry the contest's contents — no participant names, no dishes, no scores — because those are the very things being erased. The host SHALL NOT be able to read the deleted contest's history afterwards: to them it is a contest that no longer exists.

#### Scenario: The history is erased with the contest

- **WHEN** a host deletes a contest that has a recorded history of being created, published and closed
- **THEN** none of that recorded history remains

#### Scenario: The deletion itself is recorded

- **WHEN** a host deletes a contest of theirs
- **THEN** a single entry records that this host deleted this contest, when, and that they confirmed it

#### Scenario: The tombstone carries no personal detail

- **WHEN** a host deletes a contest that had named participants and submitted dishes
- **THEN** the entry left behind names none of them

#### Scenario: A deleted contest's history cannot be read back

- **WHEN** a host asks to read the history of a contest they have deleted
- **THEN** it is refused as no such contest

### Requirement: Deleting is confirmed, and confirmed harder once it costs someone else

A host SHALL NOT be able to delete a contest without confirming it, on every path that offers deletion. Once anyone has claimed a place or cast a vote in the contest, confirming SHALL require the host to reproduce the contest's name, so that deleting other people's work cannot happen by a single mis-click. A confirmation that does not match the contest SHALL NOT delete anything.

#### Scenario: Deleting an untouched contest is confirmed once

- **WHEN** a host deletes a contest that nobody has joined
- **THEN** they are asked to confirm before anything is destroyed

#### Scenario: Deleting a contest people are taking part in demands its name

- **WHEN** a host deletes a contest in which places have been claimed
- **THEN** they are required to reproduce the contest's name before it is destroyed

#### Scenario: The wrong name does not delete

- **WHEN** a host tries to confirm the deletion of a contest people have joined but does not reproduce its name correctly
- **THEN** nothing is destroyed and the contest is untouched

#### Scenario: Backing out destroys nothing

- **WHEN** a host starts to delete a contest and then backs out
- **THEN** the contest is untouched

### Requirement: Someone taking part is told the contest is gone

A participant who is taking part in a contest when its host deletes it SHALL be told that the contest is gone, rather than being shown a generic failure or left waiting. This SHALL hold on every screen that follows a live contest — entering a dish, scoring, and waiting for the results.

#### Scenario: A participant scoring when the contest is deleted

- **WHEN** a participant is scoring dishes and the host deletes the contest
- **THEN** the participant is told the contest is gone

#### Scenario: A participant waiting for the results when the contest is deleted

- **WHEN** a participant is waiting for the results and the host deletes the contest
- **THEN** the participant is told the contest is gone rather than waiting indefinitely

#### Scenario: A participant cannot act on a deleted contest

- **WHEN** a participant tries to send a vote in a contest the host has deleted
- **THEN** it is refused, and no vote is recorded

### Requirement: A host can delete through a connected assistant

A host SHALL be able to delete one of their own contests through a connected assistant, and the assistant SHALL NOT be able to carry it out until the host has explicitly approved that exact deletion. An approval SHALL authorise one deletion of one named contest and no other. The assistant SHALL act strictly as that host: it may delete only contests the host owns, and the deletion it performs SHALL destroy and record exactly what a deletion made by hand does.

#### Scenario: The assistant deletes only after the host approves

- **WHEN** a host asks a connected assistant to delete one of their own contests
- **THEN** nothing is destroyed until the host approves it, and then the contest is gone

#### Scenario: The assistant cannot delete without approval

- **WHEN** a connected assistant attempts to delete a contest without the host's approval
- **THEN** it is refused and the contest is untouched

#### Scenario: The assistant cannot delete another host's contest

- **WHEN** a host asks a connected assistant to delete a contest owned by a different host
- **THEN** it is refused as not allowed

#### Scenario: A deletion made through the assistant is recorded as host-confirmed

- **WHEN** a host deletes a contest through a connected assistant, approving when asked
- **THEN** the entry left behind records that the host confirmed it
