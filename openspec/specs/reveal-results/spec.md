# reveal-results Specification

## Purpose
TBD - created by archiving change tapas-contest-app. Update Purpose after archive.
## Requirements
### Requirement: Results are hidden until reveal
A contest's results SHALL be refused until the contest has been revealed.

#### Scenario: Results are hidden until reveal
- **WHEN** the host asks for the results of a closed contest that has not yet been revealed
- **THEN** the results are refused because the contest has not been revealed

### Requirement: Revealed results show a winner per category and an overall winner, counting only sent votes
Once revealed, a contest's results SHALL show a winner for every scoring category and an overall winner, computed by summing every judge's score per dish — a vote that was never sent SHALL NOT be counted. A dish tied for the highest total in a category, or overall, SHALL be shown as a joint winner rather than resolved automatically.

#### Scenario: The host reveals results for a closed contest
- **WHEN** every judge in a closed contest has sent a vote and the host reveals it
- **THEN** the results show a winner in every category and an overall winner

#### Scenario: A tie is shown as joint winners
- **WHEN** two dishes are tied for the top score in a category and the host reveals the contest
- **THEN** both tied dishes are listed as winners of that category

#### Scenario: An unsent vote does not count toward the results
- **WHEN** one judge never sent their vote and the host reveals the contest
- **THEN** that judge's scores are not reflected in the results

