import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router';
import { listContests, type ContestSummary } from '../api/client';

export type ContestsState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly contests: readonly ContestSummary[] }
  | { readonly kind: 'error' };

export interface Contests {
  readonly state: ContestsState;
  /** Re-reads the list after something changed it (deleted, published, closed, revealed). */
  refresh(): void;
}

const ContestsContext = createContext<Contests | undefined>(undefined);

/**
 * The host's contest list, read once and shared.
 *
 * The sidebar counts the host's contests on every screen and names the one they
 * are inside, so the list stopped being the contest list's private data. Fetching
 * it per surface would mean several copies of one answer and — worse — a sidebar
 * whose counts disagree with the table right beside it.
 *
 * Mounted only around the host's navigation: an administrator's panel draws no
 * contests, so it must not ask for any.
 */
export function ContestsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContestsState>({ kind: 'loading' });
  const [reloads, setReloads] = useState(0);
  const { pathname } = useLocation();
  const cameFrom = useRef<string | null>(null);

  const refresh = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    listContests()
      .then((contests) => live && setState({ kind: 'ready', contests }))
      .catch(() => live && setState({ kind: 'error' }));
    return () => {
      live = false;
    };
  }, [reloads]);

  /*
   * Arriving at the contest list re-reads it.
   *
   * Holding one shared list means every screen that changes one owes the list the
   * truth, and relying on each of them to remember has already failed twice: a
   * contest deleted from the control room stayed on the list, and a draft that was
   * published came back still marked as a draft. Landing on the list is the moment
   * a host checks whether what they just did took, so that is where the answer is
   * fetched rather than remembered — whatever changed it, and whether or not
   * anybody thought to say so.
   *
   * Only on arriving from somewhere else: on the first render there is nothing to
   * be stale yet, and refreshing then would fetch the same list twice.
   */
  useEffect(() => {
    const arrived = cameFrom.current !== null && cameFrom.current !== pathname;
    cameFrom.current = pathname;
    if (pathname === '/' && arrived) refresh();
  }, [pathname, refresh]);

  return (
    <ContestsContext.Provider value={{ state, refresh }}>{children}</ContestsContext.Provider>
  );
}

export function useContests(): Contests {
  const contests = useContext(ContestsContext);
  if (!contests) throw new Error('useContests must be used within a ContestsProvider');
  return contests;
}

/** How many contests the host has in total, and how many are in each state. */
export interface ContestCounts {
  readonly all: number;
  readonly live: number;
  readonly draft: number;
  /** Closed and revealed together — both are finished, and the design counts them as one. */
  readonly finished: number;
}

export function countByState(contests: readonly ContestSummary[]): ContestCounts {
  return {
    all: contests.length,
    live: contests.filter((c) => c.status === 'live').length,
    draft: contests.filter((c) => c.status === 'draft').length,
    finished: contests.filter((c) => c.status === 'closed' || c.status === 'revealed').length,
  };
}
