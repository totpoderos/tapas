import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button, Callout, DataTable, EmptyState, StatePill } from '@tapas/ui';
import type { ContestSummary } from '../api/client';
import { useDeleteContest } from '../contests/use-delete-contest';
import { useContests } from '../contests/contests-provider';
import { STATE_MARK, STATE_TONE, matchesFilter } from '../contests/contest-state';
import { whenLastChanged } from '../contests/when';
import { usePanelNav } from '../shell/use-panel-nav';
import styles from './home.module.css';

/**
 * The host's landing: their contests as one table. Every contest they own with a
 * state they can read by word and shape, what to do with it next, and a way to
 * start another. A host with none yet is invited to create their first.
 *
 * The list itself comes from the panel, not from here — the sidebar counts the
 * same contests, and two reads of one answer could disagree.
 */
export function Home() {
  const { t } = useTranslation();
  const nav = usePanelNav();
  const { state, refresh } = useContests();
  const [announcement, setAnnouncement] = useState<string | undefined>();

  // The list is re-read by the hook itself; this only says so out loud.
  const { ask, dialog, error: deleteError } = useDeleteContest((deleted) => {
    setAnnouncement(t('deleteContest.deleted', { name: deleted.name }));
  });

  const filter = nav.kind === 'deployment' ? nav.filter : undefined;
  const all = state.kind === 'ready' ? state.contests : [];
  const shown = filter ? all.filter((c) => matchesFilter(c.status, filter)) : all;

  return (
    <main id="main">
      <div className={styles.heading}>
        <h1 className={styles.title}>{t('home.title')}</h1>
        {state.kind === 'ready' && (
          <p className={styles.count}>
            {t('home.summary', {
              count: all.length,
              live: all.filter((c) => c.status === 'live').length,
            })}
          </p>
        )}
      </div>

      {state.kind === 'loading' && (
        <div className={styles.skeleton}>
          <p role="status" className={styles.note}>
            {t('home.loading')}
          </p>
          <span className={styles.bone} />
          <span className={styles.bone} />
          <span className={styles.bone} />
        </div>
      )}

      {state.kind === 'error' && (
        <div className={styles.failure}>
          <Callout tone="danger" role="alert" title={t('home.errorTitle')}>
            <p>{t('home.errorNote')}</p>
            <Button variant="ghost" onClick={refresh}>
              {t('home.retry')}
            </Button>
          </Callout>
        </div>
      )}

      {state.kind === 'ready' && all.length === 0 && (
        <EmptyState lead={t('home.emptyLead')} note={t('home.emptyNote')}>
          <Link to="/new" className={styles.newButton}>
            {t('home.emptyCta')}
          </Link>
        </EmptyState>
      )}

      {/* The list changes underneath the host, so the outcome is announced. */}
      <p role="status" className={styles.note}>
        {announcement}
      </p>
      {deleteError && (
        <p role="alert" className={styles.note}>
          {deleteError}
        </p>
      )}

      {state.kind === 'ready' && all.length > 0 && shown.length === 0 && (
        <p className={styles.note}>{t('home.noneInState')}</p>
      )}

      {state.kind === 'ready' && shown.length > 0 && (
        <DataTable label={t('home.listLabel')}>
          <thead>
            <tr>
              <th scope="col">{t('home.columns.contest')}</th>
              <th scope="col">{t('home.columns.status')}</th>
              <th scope="col">{t('home.columns.updated')}</th>
              <th scope="col">
                <span className={styles.srOnly}>{t('home.columns.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((contest) => (
              <Row key={contest.id} contest={contest} onDelete={ask} />
            ))}
          </tbody>
        </DataTable>
      )}
      {dialog}
    </main>
  );
}

function Row({
  contest,
  onDelete,
}: {
  contest: ContestSummary;
  onDelete: (c: { id: string; name: string }) => void;
}) {
  const { t, i18n } = useTranslation();
  // A draft opens for review + publishing; a published contest opens its control
  // room (tally + close/reveal, and the way to its log).
  const to = contest.status === 'draft' ? `/review/${contest.id}` : `/contest/${contest.id}`;

  return (
    <tr>
      <td>
        <Link to={to} className={styles.name}>
          {contest.name}
        </Link>
      </td>
      <td>
        <StatePill tone={STATE_TONE[contest.status]} mark={STATE_MARK[contest.status]}>
          {t(`common.contestState.${contest.status}`)}
        </StatePill>
      </td>
      <td className={styles.when}>{whenLastChanged(contest.updatedAt, i18n.language)}</td>
      <td>
        <div className={styles.rowActions}>
          <Link to={to} className={styles.open}>
            {contest.status === 'draft' ? t('home.review') : t('home.open')}
          </Link>
          <Button
            variant="ghost"
            aria-label={t('deleteContest.actionFor', { name: contest.name })}
            onClick={() => onDelete({ id: contest.id, name: contest.name })}
          >
            {t('deleteContest.action')}
          </Button>
        </div>
      </td>
    </tr>
  );
}
