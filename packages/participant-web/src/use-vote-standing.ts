import { useEffect, useState } from 'react';
import type { VoteStanding } from './bottom-bar';
import { getBallot, getMyScores, type VoteStatus } from './api/client';

/**
 * How a vote stands, from the two facts that decide it.
 *
 * `sent` beats everything — once a vote is in there is nothing outstanding
 * whatever the ballot says. Otherwise it is outstanding as soon as there is
 * something to score: not "some score is still missing", because a participant
 * who has scored every dish and not pressed send still has something to do, and
 * that is the exact moment a mark that went quiet would be misleading.
 *
 * The dish count is the BALLOT's, not the contest's. A cook's own dish is not on
 * their ballot, nor is anything an anti-bias rule excluded — so a contest with
 * one dish in it may have nothing at all for this participant to score, and
 * saying otherwise sends them to an empty screen.
 */
export function standingOf(ballotDishes: number, status: VoteStatus): VoteStanding {
  if (status === 'sent') return 'sent';
  return ballotDishes > 0 ? 'outstanding' : 'none';
}

/**
 * Reads how this participant's vote stands, for the screens that do not already
 * know — the dishes and the results. The scoring screen has both facts in hand
 * already and calls `standingOf` directly rather than reading them twice.
 *
 * ONCE, on mount, and never on a timer. The results screen is already spending
 * two polls against a rate limit a whole venue shares behind one address; a mark
 * on a tab is not worth a third, and it does not change often enough to be worth
 * watching for.
 *
 * Every failure is swallowed. A mark that cannot be read is simply not drawn:
 * this is an addition to screens that were complete without it, and the one
 * thing it must never do is become the reason a screen shows an error. Same
 * reasoning as `getTurnout` answering `null`.
 */
export function useVoteStanding(contestId: string | null): VoteStanding {
  const [standing, setStanding] = useState<VoteStanding>('none');

  useEffect(() => {
    if (!contestId) return;
    let live = true;
    Promise.all([getBallot(contestId), getMyScores(contestId)])
      .then(([ballot, mine]) => {
        if (live) setStanding(standingOf(ballot.dishes.length, mine.status));
      })
      .catch(() => {
        // Deliberately nothing. See above.
      });
    return () => {
      live = false;
    };
  }, [contestId]);

  return standing;
}
