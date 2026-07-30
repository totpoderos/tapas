import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink } from 'react-router';
import { useSession } from '../auth/session';
import { countByState, useContests } from '../contests/contests-provider';
import { STATE_MARK, type ContestState } from '../contests/contest-state';
import type { ContestSummary } from '../api/client';
import type { PanelNav } from './use-panel-nav';
import styles from './sidebar.module.css';

/**
 * The panel's navigation: one landmark, present on every screen, drawn according
 * to what the signed-in account is and where in the panel they are.
 *
 * An administrator's ways in and a host's never appear together — which one is
 * drawn is `usePanelNav`'s answer, and the other kind is absent rather than shown
 * and refused. Nothing here is a control: the API decides on every request.
 */
export function Sidebar({
  nav,
  noteSlotRef,
}: {
  nav: PanelNav;
  /** Receives the container a surface can portal a note into. */
  noteSlotRef: (element: HTMLElement | null) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <div className={styles.brand}>
        <span className={styles.dot} aria-hidden="true" />
        <b className={styles.wordmark}>{t('common.brand')}</b>
        <span className={styles.kind}>
          {nav.kind === 'admin' ? t('shell.kind.admin') : t('shell.kind.host')}
        </span>
      </div>

      <div className={styles.groups}>
        {nav.kind === 'admin' ? <AdminWays nav={nav} /> : <HostWays nav={nav} />}
        {/* Whatever the surface wants said here — what a draft still needs, say.
            The navigation knows the contest list, not what is inside a draft. */}
        <div ref={noteSlotRef} />
      </div>

      <Footer isAdministrator={nav.kind === 'admin'} />
    </>
  );
}

/** An administrator's panel: administrative work, and nothing of a host's. */
function AdminWays({ nav }: { nav: Extract<PanelNav, { kind: 'admin' }> }) {
  const { t } = useTranslation();
  return (
    <>
      <p className={styles.groupLabel}>{t('shell.groups.administration')}</p>
      <Way to="/people" current={nav.current === 'people'}>
        {t('shell.people')}
      </Way>
    </>
  );
}

/** A host's panel: their contests and the assistant, scoped to a contest when inside one. */
function HostWays({ nav }: { nav: Exclude<PanelNav, { kind: 'admin' }> }) {
  const { t } = useTranslation();
  const { state } = useContests();
  const contests = state.kind === 'ready' ? state.contests : [];
  const id = nav.kind === 'contest' ? nav.contestId : nav.kind === 'draft' ? nav.draftId : undefined;
  const inside = id === undefined ? undefined : contests.find((c) => c.id === id);

  return (
    <>
      {nav.kind === 'contest' && (
        <ContestScope nav={nav} contest={inside} loading={state.kind === 'loading'} />
      )}
      {nav.kind === 'draft' && <DraftScope nav={nav} draft={inside} />}
      {nav.kind === 'deployment' && nav.current === 'new' && <NewContestScope />}
      {nav.kind === 'deployment' && nav.current !== 'new' && (
        <DeploymentScope nav={nav} contests={contests} listed={state.kind === 'ready'} />
      )}

      {/* Inside a contest, a draft, or setting one up: the way back out. */}
      {(nav.kind !== 'deployment' || nav.current === 'new') && (
        <>
          <hr className={styles.divider} />
          <Way to="/">{t('shell.contests.all')}</Way>
          <Way to="/chat">{t('shell.assistant')}</Way>
        </>
      )}
    </>
  );
}

/**
 * Setting up a contest: where that sits in getting one going.
 *
 * Two steps, not the mockup's four. The mockup reads "1 Name · 2 Rules · 3
 * Participants · 4 Review & publish" while putting name and rules in one pane, and
 * this app has no wizard — creating is one form, and participants and publishing
 * belong to draft review. Two steps say something true; four would be navigation
 * that does not exist. What the mockup is really doing is showing where you are and
 * making saving feel cheap, and both survive.
 */
function NewContestScope() {
  const { t } = useTranslation();
  return (
    <>
      <p className={styles.groupLabel}>{t('shell.groups.newContest')}</p>
      <span className={`${styles.way} ${styles.step} ${styles.currentWay}`} aria-current="step">
        <span className={styles.stepNumber} aria-hidden="true">
          1
        </span>
        <span className={styles.wayLabel}>{t('shell.steps.setUp')}</span>
      </span>
      {/* Drawn, and said to be unreachable: there is nothing to review until the
          contest has been saved, and a host should be able to see that is next. */}
      <span className={`${styles.unavailable} ${styles.step}`} aria-disabled="true">
        <span className={styles.stepNumber} aria-hidden="true">
          2
        </span>
        <span className={styles.wayLabel}>{t('shell.steps.reviewAndPublish')}</span>
        <span className={styles.unavailableNote}>{t('shell.steps.afterSaving')}</span>
      </span>
      <div className={styles.note}>{t('shell.onlyANameIsRequired')}</div>
    </>
  );
}

/** Outside a contest: the whole of the host's own work, counted by state. */
function DeploymentScope({
  nav,
  contests,
  listed,
}: {
  nav: Extract<PanelNav, { kind: 'deployment' }>;
  contests: readonly ContestSummary[];
  listed: boolean;
}) {
  const { t } = useTranslation();
  const counts = countByState(contests);
  // Until the list is in, saying "0" would be a claim the panel cannot yet make.
  const count = (n: number) => (listed ? String(n) : undefined);
  const onList = nav.current === 'contests';

  return (
    <>
      <p className={styles.groupLabel}>{t('shell.groups.contests')}</p>
      <Way to="/" current={onList && nav.filter === undefined} count={count(counts.all)}>
        {t('shell.contests.all')}
      </Way>
      <Way
        to="/?state=live"
        current={onList && nav.filter === 'live'}
        state="live"
        count={count(counts.live)}
      >
        {t('shell.contests.live')}
      </Way>
      <Way
        to="/?state=draft"
        current={onList && nav.filter === 'draft'}
        state="draft"
        count={count(counts.draft)}
      >
        {t('shell.contests.drafts')}
      </Way>
      <Way
        to="/?state=finished"
        current={onList && nav.filter === 'finished'}
        state="closed"
        count={count(counts.finished)}
      >
        {t('shell.contests.finished')}
      </Way>
      {listed && counts.all === 0 && <p className={styles.none}>{t('shell.contests.none')}</p>}

      <hr className={styles.divider} />
      <p className={styles.groupLabel}>{t('shell.groups.workspace')}</p>
      <Way
        to="/chat"
        current={nav.current === 'assistant'}
        badge={t('shell.assistantBadge')}
      >
        {t('shell.assistant')}
      </Way>
    </>
  );
}

/** Inside a published contest: that contest's own surfaces. */
function ContestScope({
  nav,
  contest,
  loading,
}: {
  nav: Extract<PanelNav, { kind: 'contest' }>;
  contest: ContestSummary | undefined;
  loading: boolean;
}) {
  const { t } = useTranslation();
  const status = contest?.status;

  return (
    <>
      <p className={styles.groupLabel}>{t('shell.groups.thisContest')}</p>
      <Link to="/" className={styles.scopeCard}>
        <span className={styles.scopeName}>
          {contest?.name ?? (loading ? t('common.loading') : t('shell.thisContest'))}
        </span>
        <span className={styles.scopeNote}>
          {status
            ? `${t(`common.contestState.${status}`)} · ${t('shell.switchContest')}`
            : t('shell.switchContest')}
        </span>
      </Link>
      <Way to={`/contest/${nav.contestId}`} current={nav.current === 'control'}>
        {t('shell.controlRoom')}
      </Way>
      <Way to={`/log/${nav.contestId}`} current={nav.current === 'log'}>
        {t('shell.activityLog')}
      </Way>
      {/* Results exist only once they are out. Before that the way in is shown and
          said to be unavailable, rather than quietly missing — a host who is
          waiting for it should be able to see that it is coming. */}
      {status === 'revealed' ? (
        <Way to={`/results/${nav.contestId}`} current={nav.current === 'results'}>
          {t('shell.results')}
        </Way>
      ) : (
        <span className={styles.unavailable} aria-disabled="true">
          <span className={styles.wayLabel}>{t('shell.results')}</span>
          <span className={styles.unavailableNote}>{t('shell.resultsAfterReveal')}</span>
        </span>
      )}
    </>
  );
}

/** Inside a draft: the one thing there is to do with it before it can go live. */
function DraftScope({
  nav,
  draft,
}: {
  nav: Extract<PanelNav, { kind: 'draft' }>;
  draft: ContestSummary | undefined;
}) {
  const { t } = useTranslation();
  return (
    <>
      <p className={styles.groupLabel}>{t('shell.groups.thisDraft')}</p>
      <span className={styles.scopeCardStatic}>
        <span className={styles.scopeName}>{draft?.name ?? t('shell.thisDraft')}</span>
        <span className={styles.scopeNote}>{t('shell.notPublished')}</span>
      </span>
      <Way to={`/review/${nav.draftId}`} current={nav.current === 'review'}>
        {t('shell.reviewDraft')}
      </Way>
    </>
  );
}

/** Who is signed in, and the way out. */
function Footer({ isAdministrator }: { isAdministrator: boolean }) {
  const { t } = useTranslation();
  const { signOut } = useSession();
  return (
    <div className={styles.footer}>
      <span className={styles.role}>
        {isAdministrator ? t('shell.role.admin') : t('shell.role.host')}
      </span>
      <button type="button" className={styles.signOut} onClick={() => void signOut()}>
        {t('shell.signOut')}
      </button>
    </div>
  );
}

/**
 * One way in: a link, 44px tall, marked with `aria-current` when it is where the
 * host already is.
 *
 * Which one is current is passed in rather than left to `NavLink`'s own matching,
 * because several ways in share an address — `/` and its state filters differ
 * only by a query string, which router matching ignores.
 */
function Way({
  to,
  current = false,
  count,
  state,
  badge,
  children,
}: {
  readonly to: string;
  readonly current?: boolean;
  readonly count?: string;
  /** Draws this state's mark before the label, for the ways in that narrow by state. */
  readonly state?: ContestState;
  readonly badge?: string;
  readonly children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={`${styles.way} ${current ? styles.currentWay : ''}`}
      aria-current={current ? 'page' : undefined}
    >
      {state && (
        <span aria-hidden="true" className={`${styles.mark} ${styles[state]}`}>
          {STATE_MARK[state]}
        </span>
      )}
      <span className={styles.wayLabel}>{children}</span>
      {badge && <span className={styles.badge}>{badge}</span>}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </NavLink>
  );
}
