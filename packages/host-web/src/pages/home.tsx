import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@tapas/ui';
import { listContests, type ContestSummary } from '../api/client';
import { useSession } from '../auth/session';
import styles from './home.module.css';

type ListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly contests: readonly ContestSummary[] }
  | { readonly kind: 'error' };

/** How each state reads to a host — a shape per status, never colour alone (design.md §11C); the word is translated. */
const STATUS_MARK: Record<ContestSummary['status'], string> = {
  live: '●',
  draft: '◇',
  closed: '◆',
  revealed: '✓',
};

/**
 * The host's landing: their contest list. Every contest they own, each with a
 * clear status, plus a way to start a new one. A host with none yet is invited
 * to create their first.
 */
export function Home() {
  const { t } = useTranslation();
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
          <b>{t('common.brand')}</b>
        </div>
        <Link to="/chat" className={styles.assistantLink}>
          {t('home.assistant')}
        </Link>
        <Link to="/new" className={styles.newButton}>
          {t('home.newContest')}
        </Link>
        <Button variant="ghost" onClick={() => void signOut()}>
          {t('home.signOut')}
        </Button>
      </div>

      <h1 className={styles.title}>{t('home.title')}</h1>

      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          {t('home.loading')}
        </p>
      )}

      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          {t('home.error')}
        </p>
      )}

      {state.kind === 'ready' && state.contests.length === 0 && (
        <div className={styles.empty}>
          <p className={styles.emptyLead}>{t('home.emptyLead')}</p>
          <p className={styles.note}>{t('home.emptyNote')}</p>
          <Link to="/new" className={styles.newButton}>
            {t('home.emptyCta')}
          </Link>
        </div>
      )}

      {state.kind === 'ready' && state.contests.length > 0 && (
        <ul className={styles.list} aria-label={t('home.listLabel')}>
          {state.contests.map((contest) => (
            <li key={contest.id} className={styles.row}>
              {/* A draft opens for review + publishing; a published contest opens
                  its control room (tally + close/reveal, and a link to its log). */}
              <Link
                to={contest.status === 'draft' ? `/review/${contest.id}` : `/contest/${contest.id}`}
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
  const { t } = useTranslation();
  return (
    <span className={`${styles.pill} ${styles[status]}`}>
      <span aria-hidden="true">{STATUS_MARK[status]}</span> {t(`home.status.${status}`)}
    </span>
  );
}
