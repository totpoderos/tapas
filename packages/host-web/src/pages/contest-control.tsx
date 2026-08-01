import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, Callout, Card, ConfirmDialog, ProgressBar, StatTile } from '@tapas/ui';
import {
  ApiError,
  closeContest,
  getAuditLog,
  getContest,
  getTally,
  revealContest,
  type AuditEntry,
  type ContestDetail,
  type ContestRules,
  type Tally,
} from '../api/client';
import { useDeleteContest } from '../contests/use-delete-contest';
import { useContests } from '../contests/contests-provider';
import { SOURCE_MARK, eventKeyFor } from '../contests/audit-event';
import { ScannableCode } from '../contests/scannable-code';
import styles from './contest-control.module.css';

const TALLY_POLL_MS = 3000;
/** How much of the log the control room shows before sending the host to all of it. */
const RECENT_ACTIVITY = 3;

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly contest: ContestDetail; readonly tally: Tally }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error' };

/**
 * The host's control room for one contest (design.md §7). While it is live the
 * host watches the tally fill — who has joined, is still scoring, and has sent —
 * and drives the contest: close voting, then reveal. Closing and revealing can't
 * be undone, so each goes through a confirmation, and the audit log records that
 * the host confirmed it.
 *
 * It carries no chrome of its own. The panel names the contest, says what state it
 * is in, and offers the way to its activity log; repeating any of that here was
 * what made three browser assertions ambiguous.
 */
export function ContestControl() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [pending, setPending] = useState<'close' | 'reveal' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();
  const { refresh: refreshContests } = useContests();

  // Deleting takes the contest away, so it takes the host back to their list.
  const { ask: askDelete, dialog: deleteDialog, error: deleteError } = useDeleteContest(() =>
    navigate('/'),
  );

  const load = useCallback(async () => {
    try {
      const [contest, tally] = await Promise.all([getContest(id), getTally(id)]);
      setState({ kind: 'ready', contest, tally });
    } catch (caught) {
      const missing = caught instanceof ApiError && (caught.status === 404 || caught.status === 403);
      setState(missing ? { kind: 'missing' } : { kind: 'error' });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * While the contest is live, keep the tally AND the contest fresh.
   *
   * The contest matters as much as the counts because a contest can close
   * itself: the default close rule is `all_sent`, so the moment the last vote
   * lands the contest is closed with nobody having pressed anything. Polling the
   * tally alone left the panel watching the counts fill while it went on
   * believing the contest was live — "Close voting" still offered, "Reveal
   * results" still disabled — and the host's only way through was to press
   * Close, be told the contest could not be closed, and carry on from the error.
   */
  const live = state.kind === 'ready' && state.contest.status === 'live';
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      Promise.all([getContest(id), getTally(id)])
        .then(([contest, tally]) => {
          setState((s) => (s.kind === 'ready' ? { kind: 'ready', contest, tally } : s));
          // A contest that closed itself is a state change the panel's own
          // navigation shows too, so the shared list has to hear about it.
          if (contest.status !== 'live') refreshContests();
        })
        .catch(() => {});
    }, TALLY_POLL_MS);
    return () => clearInterval(timer);
  }, [live, id, refreshContests]);

  async function onConfirm() {
    const action = pending;
    if (!action) return;
    setPending(null);
    setBusy(true);
    setActionError(undefined);
    try {
      await (action === 'close' ? closeContest(id) : revealContest(id));
    } catch (caught) {
      /*
       * The contest may have reached this state on its own in the moment
       * between the last poll and the press — `all_sent` closes it as the last
       * vote lands, and a scheduled reveal fires on its own clock. The host
       * asked for it to be closed and it is closed: that is the outcome they
       * wanted, not a failure, and reporting it as one sends them looking for a
       * problem that does not exist.
       *
       * Anything else is a real refusal and still says so.
       */
      const alreadyDone =
        caught instanceof ApiError &&
        caught.code === (action === 'close' ? 'ALREADY_CLOSED' : 'ALREADY_REVEALED');
      if (!alreadyDone) {
        setActionError(
          action === 'close' ? t('contestControl.closeError') : t('contestControl.revealError'),
        );
        setBusy(false);
        return;
      }
    }
    await load();
    // The contest's state is on the panel's navigation too — it names this
    // contest and says what it is — so the shared list has to hear about it, or
    // the sidebar goes on calling a closed contest live.
    refreshContests();
    setBusy(false);
  }

  return (
    <main id="main">
      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          {t('contestControl.loading')}
        </p>
      )}
      {state.kind === 'missing' && (
        <>
          <h1 className={styles.title}>{t('contestControl.notFoundTitle')}</h1>
          <p className={styles.note}>{t('contestControl.notFoundBody')}</p>
        </>
      )}
      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          {t('contestControl.loadError')}
        </p>
      )}

      {state.kind === 'ready' && (
        <div className={styles.columns}>
          <div className={styles.main}>
            {state.contest.status !== 'revealed' && <JoinCode code={state.contest.joinCode} />}

            <Progress tally={state.tally} />

            {(deleteError ?? actionError) && (
              <Callout tone="danger" role="alert">
                <p>{deleteError ?? actionError}</p>
              </Callout>
            )}

            <Drive
              status={state.contest.status}
              contestId={state.contest.id}
              onAsk={setPending}
              busy={busy}
            />
          </div>

          <div className={styles.aside}>
            <RecentActivity contestId={state.contest.id} />
            <RulesInForce rules={state.contest.rules} />
            <DangerZone
              onDelete={() => askDelete({ id: state.contest.id, name: state.contest.name })}
            />
          </div>
        </div>
      )}

      {deleteDialog}

      {pending ? (
        <ConfirmDialog
          title={t(`contestControl.confirm.${pending}.title`)}
          body={t(`contestControl.confirm.${pending}.body`)}
          confirmLabel={t(`contestControl.confirm.${pending}.confirm`)}
          cancelLabel={t('contestControl.confirm.cancel')}
          workingLabel={t('contestControl.confirm.working')}
          variant={pending === 'close' ? 'danger' : 'brand'}
          busy={busy}
          onConfirm={() => void onConfirm()}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </main>
  );
}

/** The code people join with, and two ways to hand it over without reading it out. */
function JoinCode({ code }: { code: string }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [scannable, setScannable] = useState(false);
  const scannableId = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Some browsers refuse the clipboard without a permission the host has not
      // given. The code is on screen either way, so this is a convenience that
      // failed, not an error worth interrupting them about.
      setCopied(false);
    }
  }

  return (
    <div className={styles.code}>
      <div className={styles.codeMain}>
        <div>
          <p className={styles.codeLabel}>{t('contestControl.joinCode')}</p>
          <span className={styles.codeValue}>{code}</span>
        </div>
        <div className={styles.codeActions}>
          <Button variant="ghost" onClick={() => void copy()}>
            {t('contestControl.copyCode')}
          </Button>
          {/*
            A disclosure, not a permanent fixture: the code is large, and a host
            watching a tally does not need it in the way until they are handing the
            contest out. `aria-expanded` is what says whether it is showing.
          */}
          <Button
            variant="ghost"
            aria-expanded={scannable}
            aria-controls={scannableId}
            onClick={() => setScannable((showing) => !showing)}
          >
            {scannable ? t('contestControl.hideScannable') : t('contestControl.showScannable')}
          </Button>
          {/* Announced, because a copy that says nothing leaves the host guessing. */}
          <span role="status" className={styles.copied}>
            {copied ? t('contestControl.copied') : ''}
          </span>
        </div>
      </div>
      {/* The code stays printed above either way — a scan yields the code, which
          somebody then types, and a phone without a camera to hand is still stuck
          otherwise. */}
      <div id={scannableId}>{scannable && <ScannableCode code={code} />}</div>
    </div>
  );
}

/**
 * How far along the voting is: the counts, and the same thing as a bar.
 *
 * Everything is said against the roster's size. "One has sent" means nothing on
 * its own; "one of four" is what a host at a venue is asking.
 */
function Progress({ tally }: { tally: Tally }) {
  const { t } = useTranslation();
  const { placeCount, claimedCount, draftCount, sentCount } = tally;
  const share = (n: number) => (placeCount === 0 ? 0 : n / placeCount);

  return (
    <Card
      title={t('contestControl.progress')}
      aside={t('contestControl.joinedOf', { joined: claimedCount, total: placeCount })}
    >
      <div className={styles.tiles}>
        <StatTile value={claimedCount} label={t('contestControl.joined')} />
        <StatTile value={draftCount} label={t('contestControl.stillScoring')} tone="pending" />
        <StatTile value={sentCount} label={t('contestControl.votesSent')} tone="good" />
      </div>
      <ProgressBar
        segments={[
          { of: share(sentCount), tone: 'good' },
          { of: share(draftCount), tone: 'pending' },
        ]}
        label={t('contestControl.sentOf', { sent: sentCount, total: placeCount })}
      />
      <ul className={styles.legend}>
        <li>
          <span aria-hidden="true" className={`${styles.key} ${styles.keySent}`} />
          {t('contestControl.legendSent')}
        </li>
        <li>
          <span aria-hidden="true" className={`${styles.key} ${styles.keyScoring}`} />
          {t('contestControl.legendScoring')}
        </li>
        <li>
          <span aria-hidden="true" className={`${styles.key} ${styles.keyNotJoined}`} />
          {t('contestControl.legendNotJoined')}
        </li>
      </ul>
    </Card>
  );
}

/**
 * The two actions that move a contest on, and the warning that they are one-way.
 *
 * Revealing is drawn before it is possible rather than appearing from nowhere: a
 * host waiting to reveal can see that it is what comes next. It is disabled, not
 * merely styled as such, so the keyboard cannot reach a button that would refuse.
 */
function Drive({
  status,
  contestId,
  onAsk,
  busy,
}: {
  status: ContestDetail['status'];
  contestId: string;
  onAsk: (action: 'close' | 'reveal') => void;
  busy: boolean;
}) {
  const { t } = useTranslation();

  if (status === 'revealed') {
    return (
      <Card title={t('contestControl.driveTitle')}>
        <p className={styles.note}>{t('contestControl.revealedNote')}</p>
        <Link to={`/results/${contestId}`} className={styles.resultsLink}>
          {t('contestControl.seeResults')}
        </Link>
      </Card>
    );
  }

  return (
    <Card title={t('contestControl.driveTitle')}>
      <div className={styles.drive}>
        <Button variant="danger" onClick={() => onAsk('close')} disabled={busy || status !== 'live'}>
          {t('contestControl.closeVoting')}
        </Button>
        <Button onClick={() => onAsk('reveal')} disabled={busy || status !== 'closed'}>
          {t('contestControl.revealResults')}
        </Button>
        <p className={styles.driveNote}>{t('contestControl.driveNote')}</p>
      </div>
    </Card>
  );
}

/** The last few things that happened, and the way to all of them. */
function RecentActivity({ contestId }: { contestId: string }) {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<readonly AuditEntry[] | 'failed' | undefined>();

  useEffect(() => {
    let live = true;
    getAuditLog(contestId)
      .then((all) => {
        // The log arrives oldest first; the control room wants the newest few.
        if (live) setEntries([...all].reverse().slice(0, RECENT_ACTIVITY));
      })
      .catch(() => live && setEntries('failed'));
    return () => {
      live = false;
    };
  }, [contestId]);

  return (
    <Card
      title={t('contestControl.recentActivity')}
      level={3}
      aside={
        <Link to={`/log/${contestId}`} className={styles.fullLog}>
          {t('contestControl.fullLog')}
        </Link>
      }
    >
      {entries === undefined && <p className={styles.note}>{t('common.loading')}</p>}
      {entries === 'failed' && <p className={styles.note}>{t('contestControl.activityFailed')}</p>}
      {Array.isArray(entries) && entries.length === 0 && (
        <p className={styles.note}>{t('contestControl.noActivity')}</p>
      )}
      {Array.isArray(entries) && entries.length > 0 && (
        <ul className={styles.activity}>
          {entries.map((entry) => (
            <Happened key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * One recorded action, named the way the full activity log names it and marked with
 * the same shape — the two screens share that vocabulary rather than each keeping
 * its own.
 */
function Happened({ entry }: { entry: AuditEntry }) {
  const { t } = useTranslation();
  const key = eventKeyFor(entry.type);
  return (
    <li className={styles.happened}>
      {/* An unknown event type shows as itself: that is data, and better than blank. */}
      <span className={styles.event}>{key ? t(`auditLog.event.${key}`) : entry.type}</span>
      <span className={styles.eventHow}>
        <span aria-hidden="true">{SOURCE_MARK[entry.sourcePath]}</span>{' '}
        {t(`auditLog.source.${entry.sourcePath}`)}
      </span>
    </li>
  );
}

/**
 * What the contest is being played by. Read from the contest, because the draft it
 * was published from no longer exists — and each line is omitted when the contest
 * does not record it, rather than guessed — `format` especially: `'solo'` is a
 * real choice a host can make, so an unrecorded format must not read as one.
 */
function RulesInForce({ rules }: { rules: ContestRules }) {
  const { t } = useTranslation();
  const lines: { key: string; label: string; value: string }[] = [];

  if (rules.format) {
    lines.push({
      key: 'format',
      label: t('contestControl.rules.format'),
      value: t(`common.format.${rules.format}`),
    });
  }
  if (rules.categories.length > 0) {
    lines.push({
      key: 'categories',
      label: t('contestControl.rules.categories'),
      value: rules.categories.map((category) => category.name).join(', '),
    });
  }
  if (rules.scoreRange) {
    lines.push({
      key: 'scoreRange',
      label: t('contestControl.rules.scoreRange'),
      value: t('contestControl.rules.band', {
        min: rules.scoreRange.min,
        max: rules.scoreRange.max,
      }),
    });
  }
  lines.push({
    key: 'uniquePerCategory',
    label: t('contestControl.rules.uniquePerCategory'),
    value: rules.uniquePerCategory ? t('common.on') : t('common.off'),
  });

  return (
    <Card title={t('contestControl.rulesTitle')} level={3}>
      <dl className={styles.rules}>
        {lines.map((line) => (
          <div key={line.key} className={styles.rule}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

/** Deleting, kept apart from everything else and saying what it would take away. */
function DangerZone({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <Callout tone="danger" title={t('contestControl.dangerTitle')}>
      <p>{t('contestControl.dangerBody')}</p>
      <Button variant="ghost" className={styles.dangerButton} onClick={onDelete}>
        {t('deleteContest.action')}
      </Button>
    </Callout>
  );
}
