import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { StatePill } from '@tapas/ui';
import { useContests } from '../contests/contests-provider';
import { STATE_MARK, STATE_TONE } from '../contests/contest-state';
import type { ContestSummary } from '../api/client';
import type { PanelNav } from './use-panel-nav';
import styles from './top-bar.module.css';

/**
 * The panel's header: where the host is, and the one action that belongs to the
 * whole panel rather than to a surface.
 *
 * Actions that belong to a surface — publish, export, close voting — stay on that
 * surface. The bar says where you are; it does not collect everything that can
 * be done.
 */
export function TopBar({
  nav,
  actionSlotRef,
}: {
  nav: PanelNav;
  /** Receives the container the surface's own actions are portalled into. */
  actionSlotRef: (element: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <header className={styles.bar}>
      {/*
       * The crumbs carry the right-hand reservation for the language pill and the
       * theme toggle, which are fixed to the top-right of every screen — sign-in
       * included, so they cannot move in here. Keeping the reservation on this row
       * alone means the actions below it get the full width when the bar wraps.
       */}
      <div className={styles.crumbs}>
        {nav.kind === 'admin' ? (
          <span className={styles.here}>{t('shell.people')}</span>
        ) : (
          <HostCrumbs nav={nav} />
        )}
      </div>

      <div className={styles.actions}>
        {/* Whatever the surface puts here comes first: it is about this screen,
            where starting another contest is about the panel. */}
        <div ref={actionSlotRef} className={styles.surfaceActions} />
        {/* Not offered where the surface has actions of its own: setting a contest
            up, or getting one ready to go live. Starting another contest is not what
            the host is doing there, and it competes with what is. */}
        {nav.kind !== 'admin' &&
          nav.kind !== 'draft' &&
          !(nav.kind === 'deployment' && nav.current === 'new') && (
            <Link to="/new" className={styles.newContest}>
              {t('shell.newContest')}
            </Link>
          )}
      </div>
    </header>
  );
}

/** Contests / this contest / this surface — only the parts that apply. */
function HostCrumbs({ nav }: { nav: Exclude<PanelNav, { kind: 'admin' }> }) {
  const { t } = useTranslation();
  const { state } = useContests();
  const contests = state.kind === 'ready' ? state.contests : [];
  const id = nav.kind === 'contest' ? nav.contestId : nav.kind === 'draft' ? nav.draftId : undefined;
  const inside = id === undefined ? undefined : contests.find((c) => c.id === id);

  if (nav.kind === 'deployment') {
    return (
      <>
        <span className={styles.here}>
          {nav.current === 'assistant'
            ? t('shell.assistant')
            : nav.current === 'new'
              ? t('shell.newContest')
              : t('shell.contests.all')}
        </span>
        {nav.filter && (
          <span className={styles.crumbNote}>{t(`shell.contests.${filterKey(nav.filter)}`)}</span>
        )}
      </>
    );
  }

  const surface =
    nav.kind === 'draft'
      ? t('shell.reviewDraft')
      : nav.current === 'log'
        ? t('shell.activityLog')
        : nav.current === 'results'
          ? t('shell.results')
          : t('shell.controlRoom');

  return (
    <>
      <Link to="/" className={styles.crumbLink}>
        {t('shell.contests.all')}
      </Link>
      <span aria-hidden="true" className={styles.slash}>
        /
      </span>
      <span className={styles.crumbName}>{inside?.name ?? ''}</span>
      <span aria-hidden="true" className={styles.slash}>
        /
      </span>
      <span className={styles.here}>{surface}</span>
      {inside && <State status={inside.status} />}
      {/* Only while there is something to keep up with: the control room re-reads
          the tally on a timer, and a host watching it should know that rather than
          wonder whether to reload. */}
      {inside?.status === 'live' && nav.current === 'control' && (
        <span className={styles.keepingUp}>
          <span aria-hidden="true" className={styles.pulse} />
          {t('shell.tallyKeepingUp')}
        </span>
      )}
    </>
  );
}

function State({ status }: { status: ContestSummary['status'] }) {
  const { t } = useTranslation();
  return (
    <StatePill tone={STATE_TONE[status]} mark={STATE_MARK[status]}>
      {t(`common.contestState.${status}`)}
    </StatePill>
  );
}

function filterKey(filter: 'live' | 'draft' | 'finished'): string {
  return filter === 'draft' ? 'drafts' : filter === 'finished' ? 'finished' : 'live';
}
