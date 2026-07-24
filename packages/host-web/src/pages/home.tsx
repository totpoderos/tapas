import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@tapas/ui';
import { listContests, type ContestSummary } from '../api/client';
import { useSession } from '../auth/session';
import styles from './home.module.css';

type ListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly contests: readonly ContestSummary[] }
  | { readonly kind: 'error' };

/** How each state reads to a host — a word and a shape, never colour alone (design.md §11C). */
const STATUS: Record<ContestSummary['status'], { readonly label: string; readonly mark: string }> = {
  live: { label: 'Live', mark: '●' },
  draft: { label: 'Draft', mark: '◇' },
  closed: { label: 'Closed', mark: '◆' },
  revealed: { label: 'Revealed', mark: '✓' },
};

/**
 * The host's landing: their contest list. Every contest they own, each with a
 * clear status, plus a way to start a new one. A host with none yet is invited
 * to create their first.
 */
export function Home() {
  const { signOut } = useSession();
  const [state, setState] = useState<ListState>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    listContests()
      .then((contests) => live && setState({ kind: 'ready', contests }))
      .catch(() => live && setState({ kind: 'error' }));
    return () => {
      live = false;
    };
  }, []);

  return (
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>Tapas</b>
        </div>
        <Link to="/chat" className={styles.assistantLink}>
          Assistant
        </Link>
        <Link to="/new" className={styles.newButton}>
          New contest
        </Link>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>

      <h1 className={styles.title}>Your contests</h1>

      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          Loading your contests…
        </p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          Your contests couldn’t be loaded. Please try again.
        </p>
      )}

      {state.kind === 'ready' && state.contests.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyLead}>You don’t have any contests yet.</p>
          <p className={styles.note}>Create your first contest to get started.</p>
          <Link to="/new" className={styles.newButton}>
            Create your first contest
          </Link>
        </div>
      )}

      {state.kind === 'ready' && state.contests.length > 0 && (
        <ul className={styles.list} aria-label="Your contests">
          {state.contests.map((contest) => (
            <li key={contest.id} className={styles.row}>
              {/* A draft opens for review + publishing; a published contest opens
                  its activity log (its detail screen for now). */}
              <Link
                to={contest.status === 'draft' ? `/review/${contest.id}` : `/log/${contest.id}`}
                className={styles.name}
              >
                {contest.name}
              </Link>
              <StatusPill status={contest.status} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatusPill({ status }: { status: ContestSummary['status'] }) {
  const { label, mark } = STATUS[status];
  return (
    <span className={`${styles.pill} ${styles[status]}`}>
      <span aria-hidden="true">{mark}</span> {label}
    </span>
  );
}
