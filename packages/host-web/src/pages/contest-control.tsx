import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@tapas/ui';
import {
  ApiError,
  closeContest,
  getContest,
  getTally,
  revealContest,
  type ContestDetail,
  type Tally,
} from '../api/client';
import styles from './contest-control.module.css';

const STATUS: Record<ContestDetail['status'], { label: string; mark: string }> = {
  live: { label: 'Live', mark: '●' },
  closed: { label: 'Closed', mark: '◆' },
  revealed: { label: 'Revealed', mark: '✓' },
};

const TALLY_POLL_MS = 3000;

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
 */
export function ContestControl() {
  const { id = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [pending, setPending] = useState<'close' | 'reveal' | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();

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

  // While the contest is live, keep the tally fresh.
  const live = state.kind === 'ready' && state.contest.status === 'live';
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      getTally(id)
        .then((tally) => setState((s) => (s.kind === 'ready' ? { ...s, tally } : s)))
        .catch(() => {});
    }, TALLY_POLL_MS);
    return () => clearInterval(timer);
  }, [live, id]);

  async function onConfirm() {
    const action = pending;
    if (!action) return;
    setPending(null);
    setBusy(true);
    setActionError(undefined);
    try {
      await (action === 'close' ? closeContest(id) : revealContest(id));
      await load();
    } catch {
      setActionError(
        action === 'close'
          ? 'The contest couldn’t be closed. Please try again.'
          : 'The contest couldn’t be revealed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>Tapas</b>
        </div>
        <Link to="/" className={styles.back}>
          Back to contests
        </Link>
      </div>

      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          Loading the contest…
        </p>
      )}
      {state.kind === 'missing' && (
        <>
          <h1 className={styles.title}>Contest not found</h1>
          <p className={styles.note}>This contest doesn’t exist, or isn’t yours.</p>
        </>
      )}
      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          The contest couldn’t be loaded. Please try again.
        </p>
      )}

      {state.kind === 'ready' && (
        <>
          <div className={styles.head}>
            <h1 className={styles.title}>{state.contest.name}</h1>
            <span className={`${styles.pill} ${styles[state.contest.status]}`}>
              <span aria-hidden="true">{STATUS[state.contest.status].mark}</span>{' '}
              {STATUS[state.contest.status].label}
            </span>
          </div>

          {state.contest.status !== 'revealed' && (
            <div className={styles.code}>
              <p className={styles.codeLabel}>Join code</p>
              <span className={styles.codeValue}>{state.contest.joinCode}</span>
            </div>
          )}

          <div className={styles.tally} aria-label="Progress">
            <Stat num={state.tally.claimedCount} label="Joined" />
            <Stat num={state.tally.draftCount} label="Still scoring" />
            <Stat num={state.tally.sentCount} label="Votes sent" />
          </div>

          {actionError ? (
            <div className={styles.alert} role="alert">
              <span aria-hidden="true">✕</span>
              <span>{actionError}</span>
            </div>
          ) : null}

          <div className={styles.actions}>
            {state.contest.status === 'live' && (
              <Button variant="danger" onClick={() => setPending('close')}>
                Close voting
              </Button>
            )}
            {state.contest.status === 'closed' && (
              <Button onClick={() => setPending('reveal')}>Reveal results</Button>
            )}
            {state.contest.status === 'revealed' && (
              <p className={styles.note}>The results are out — participants can see them.</p>
            )}
            <Link to={`/log/${state.contest.id}`} className={styles.logLink}>
              Activity log
            </Link>
          </div>
        </>
      )}

      {pending ? (
        <ConfirmDialog
          action={pending}
          busy={busy}
          onConfirm={() => void onConfirm()}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </main>
  );
}

function Stat({ num, label }: { num: number; label: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statNum}>{num}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}

const COPY: Record<'close' | 'reveal', { title: string; body: string; confirm: string }> = {
  close: {
    title: 'Close voting?',
    body: 'No more votes can be sent after this, and it can’t be reopened.',
    confirm: 'Close voting',
  },
  reveal: {
    title: 'Reveal the results?',
    body: 'The winners become visible to everyone. This can’t be undone.',
    confirm: 'Reveal results',
  },
};

/** A focus-trapped confirmation before an irreversible action (design.md §7.1). */
function ConfirmDialog({
  action,
  busy,
  onConfirm,
  onCancel,
}: {
  action: 'close' | 'reveal';
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const copy = COPY[action];

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('button')?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button')];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className={styles.backdrop}>
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
        className={styles.card}
      >
        <h2 id="confirm-title" className={styles.cardTitle}>
          {copy.title}
        </h2>
        <p id="confirm-body" className={styles.cardBody}>
          {copy.body}
        </p>
        <div className={styles.cardActions}>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={action === 'close' ? 'danger' : 'brand'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : copy.confirm}
          </Button>
        </div>
      </div>
    </div>
  );
}
