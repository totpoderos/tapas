import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@tapas/ui';
import {
  confirmAssistantAction,
  sendAssistantMessage,
  type AssistantMessage,
  type AssistantTurn,
  type PendingAction,
} from '../api/client';
import styles from './chat.module.css';

const ACTION_LABEL: Record<string, string> = {
  close_contest: 'close this contest',
  publish_contest: 'publish this contest',
  trigger_reveal: 'reveal the results',
};
const labelFor = (action: string) => ACTION_LABEL[action] ?? action.replace(/_/g, ' ');

function resultSummary(action: string, result: unknown): string {
  const status =
    result && typeof result === 'object' && 'status' in result
      ? String((result as { status: unknown }).status)
      : undefined;
  return status ? `✓ ${labelFor(action)} — now ${status}` : `✓ ${labelFor(action)} — done`;
}

// Read tools that return a *list of contests* — their answer is the data, so it
// is rendered as a list rather than a bare "done" ticket.
const CONTEST_LIST_ACTIONS = new Set(['list_my_contests', 'find_contest']);
// Tools whose result is a single contest's details (or candidates to choose from).
const DETAILS_ACTIONS = new Set(['get_contest_details', 'add_participant', 'remove_participant']);
const STATUS_MARK: Record<string, string> = { live: '●', draft: '◇', closed: '◆', revealed: '✓' };

interface ContestRow {
  readonly name: string;
  readonly status: string;
}

interface ContestDetails {
  readonly name: string;
  readonly status: string;
  readonly participants: readonly string[];
  readonly categories: readonly string[];
}

/** Reads the get_contest_details response: one contest's details, or candidates to choose from. */
function readDetails(result: unknown): { details?: ContestDetails; candidates?: ContestRow[] } {
  if (!result || typeof result !== 'object') return {};
  const record = result as Record<string, unknown>;
  const candidates = contestRows(record.candidates);
  if (record.details && typeof record.details === 'object') {
    const d = record.details as Record<string, unknown>;
    return {
      details: {
        name: typeof d.name === 'string' ? d.name : '',
        status: typeof d.status === 'string' ? d.status : '',
        participants: Array.isArray(d.participants) ? d.participants.map(String) : [],
        categories: Array.isArray(d.categories) ? d.categories.map(String) : [],
      },
    };
  }
  return { candidates: candidates ?? [] };
}

/** Reads a contest list out of a tool result, defensively — null if it is not one. */
function contestRows(result: unknown): ContestRow[] | null {
  if (!Array.isArray(result)) return null;
  return result.map((row) => {
    const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return {
      name: typeof record.name === 'string' ? record.name : '(unnamed contest)',
      status: typeof record.status === 'string' ? record.status : '',
    };
  });
}

/** A one-line recap of a contest list, kept in the conversation so the model has context. */
function summariseRows(rows: ContestRow[]): string {
  if (rows.length === 0) return 'You have no contests.';
  return `Your contests: ${rows.map((r) => `${r.name} (${r.status})`).join(', ')}.`;
}

/** A one-line recap of a contest's details, kept in the conversation for context. */
function detailsSummary(details: ContestDetails): string {
  const who = details.participants.length ? details.participants.join(', ') : 'no one yet';
  const cats = details.categories.length ? details.categories.join(', ') : 'no categories yet';
  return `${details.name} (${details.status}) — taking part: ${who}; scored on: ${cats}.`;
}

type Feed =
  | { readonly id: number; readonly kind: 'user' | 'assistant' | 'note'; readonly text: string }
  | { readonly id: number; readonly kind: 'ticket'; readonly text: string }
  | { readonly id: number; readonly kind: 'contests'; readonly rows: readonly ContestRow[] }
  | { readonly id: number; readonly kind: 'details'; readonly details: ContestDetails };

/** Omit that distributes over a union, so each member keeps its own fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type FeedInput = DistributiveOmit<Feed, 'id'>;

// The conversation is kept in sessionStorage so it survives leaving the chat for
// another screen (e.g. the new-contest form) and coming back, and a reload —
// cleared only when the tab closes. No secrets live here (just the visible
// conversation), and it is scoped to the tab.
const CHAT_STORAGE_KEY = 'tapas.chat.v1';

interface PersistedChat {
  readonly feed: readonly Feed[];
  readonly history: readonly AssistantMessage[];
}

function loadChat(): PersistedChat {
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return { feed: [], history: [] };
    const parsed = JSON.parse(raw) as Partial<PersistedChat>;
    return {
      feed: Array.isArray(parsed.feed) ? parsed.feed : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { feed: [], history: [] };
  }
}

/**
 * The host's chat panel (design.md §7). The host directs their contest in plain
 * language; the panel shows the assistant's words AND the actions it takes, so
 * the host stays in the loop. A destructive action is never run on the spot — it
 * surfaces a confirmation card the host must accept first (§7.1).
 */
export function Chat() {
  const initial = useMemo(loadChat, []);
  const [feed, setFeed] = useState<readonly Feed[]>(initial.feed);
  const [history, setHistory] = useState<readonly AssistantMessage[]>(initial.history);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const nextId = useRef(initial.feed.reduce((max, item) => Math.max(max, item.id + 1), 0));
  const inputRef = useRef<HTMLInputElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const add = (item: FeedInput) => setFeed((f) => [...f, { ...item, id: nextId.current++ } as Feed]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView?.({ block: 'end' });
  }, [feed, pending]);

  // Persist the conversation so it survives navigating away and back, or a reload.
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ feed, history }));
    } catch {
      // Storage full or unavailable — the conversation just won't persist.
    }
  }, [feed, history]);

  // Return focus to the composer after each turn (and on entering the panel), so
  // the host can keep typing without reaching for the mouse. Not while a
  // confirmation card is open — that traps its own focus.
  useEffect(() => {
    if (!busy && !pending) inputRef.current?.focus();
  }, [busy, pending]);

  function applyTurn(turn: AssistantTurn) {
    if (turn.kind === 'reply') {
      // A small model sometimes returns an empty reply; show a nudge rather than
      // a blank bubble, so the host always gets a response.
      const text = turn.text.trim() || 'I didn’t catch that. Try, for example, “list my contests”.';
      add({ kind: 'assistant', text });
      setHistory((h) => [...h, { role: 'assistant', content: text }]);
    } else if (turn.kind === 'result' && DETAILS_ACTIONS.has(turn.action)) {
      // Details resolve to one contest, or to candidates when a name is shared.
      const { details, candidates } = readDetails(turn.result);
      if (details) {
        add({ kind: 'details', details });
        setHistory((h) => [...h, { role: 'assistant', content: detailsSummary(details) }]);
      } else if (candidates && candidates.length > 0) {
        add({ kind: 'note', text: 'Several contests have that name — which one?' });
        add({ kind: 'contests', rows: candidates });
        setHistory((h) => [...h, { role: 'assistant', content: 'Several contests have that name.' }]);
      } else {
        // Adding/removing works on a draft; the details tool works on any contest.
        const text =
          turn.action === 'get_contest_details' ? 'No contest by that name.' : 'No draft by that name to change.';
        add({ kind: 'note', text });
        setHistory((h) => [...h, { role: 'assistant', content: text }]);
      }
    } else if (turn.kind === 'result') {
      const rows = CONTEST_LIST_ACTIONS.has(turn.action) ? contestRows(turn.result) : null;
      if (rows) {
        // A read tool's answer IS its data — render the contests, not a "done" ticket.
        if (rows.length === 0) {
          add({
            kind: 'note',
            text: turn.action === 'find_contest' ? 'No contest by that name.' : 'You have no contests yet.',
          });
        } else {
          add({ kind: 'contests', rows });
        }
        if (turn.text) add({ kind: 'assistant', text: turn.text });
        setHistory((h) => [...h, { role: 'assistant', content: turn.text || summariseRows(rows) }]);
      } else {
        add({ kind: 'ticket', text: resultSummary(turn.action, turn.result) });
        if (turn.text) add({ kind: 'assistant', text: turn.text });
        setHistory((h) => [...h, { role: 'assistant', content: turn.text || `Done — ${labelFor(turn.action)}.` }]);
      }
    } else {
      add({ kind: 'assistant', text: turn.message });
      setPending({ action: turn.action, args: turn.args, confirmationToken: turn.confirmationToken });
    }
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    add({ kind: 'user', text });
    const nextHistory = [...history, { role: 'user' as const, content: text }];
    setHistory(nextHistory);
    setInput('');
    setBusy(true);
    try {
      applyTurn(await sendAssistantMessage(nextHistory));
    } catch {
      add({ kind: 'note', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function onConfirm() {
    const action = pending;
    if (!action) return;
    setPending(null);
    setBusy(true);
    try {
      applyTurn(await confirmAssistantAction(action));
    } catch {
      add({ kind: 'note', text: 'Something went wrong carrying that out. Please try again.' });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onCancel() {
    setPending(null);
    add({ kind: 'note', text: 'Cancelled — nothing was changed.' });
    setHistory((h) => [...h, { role: 'assistant', content: 'Cancelled — nothing was changed.' }]);
    inputRef.current?.focus();
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

      <h1 className={styles.title}>Assistant</h1>
      <p className={styles.lead}>Tell the assistant what to do with your contests, in plain language.</p>

      <div className={styles.feed} role="log" aria-label="Conversation" aria-live="polite">
        {feed.map((item) =>
          item.kind === 'ticket' ? (
            <div key={item.id} className={styles.ticket}>
              <span className={styles.ticketAction}>{item.text}</span>
            </div>
          ) : item.kind === 'details' ? (
            <div key={item.id} className={styles.details}>
              <div className={styles.detailsHead}>
                <span className={styles.contestMark} aria-hidden="true">
                  {STATUS_MARK[item.details.status] ?? '•'}
                </span>
                <span className={styles.contestName}>{item.details.name}</span>
                <span className={styles.contestStatus}>{item.details.status}</span>
              </div>
              <dl className={styles.detailsBody}>
                <dt className={styles.detailsTerm}>Taking part</dt>
                <dd className={styles.detailsValue}>
                  {item.details.participants.length ? item.details.participants.join(', ') : 'No one yet'}
                </dd>
                <dt className={styles.detailsTerm}>Scored on</dt>
                <dd className={styles.detailsValue}>
                  {item.details.categories.length ? item.details.categories.join(', ') : 'No categories yet'}
                </dd>
              </dl>
            </div>
          ) : item.kind === 'contests' ? (
            <ul key={item.id} className={styles.contestList} aria-label="Contests">
              {item.rows.map((row, index) => (
                <li key={index} className={styles.contestRow}>
                  <span className={styles.contestMark} aria-hidden="true">
                    {STATUS_MARK[row.status] ?? '•'}
                  </span>
                  <span className={styles.contestName}>{row.name}</span>
                  <span className={styles.contestStatus}>{row.status}</span>
                </li>
              ))}
            </ul>
          ) : item.kind === 'note' ? (
            <p key={item.id} className={styles.note}>
              {item.text}
            </p>
          ) : (
            <div key={item.id} className={`${styles.turn} ${styles[item.kind]}`}>
              <div className={styles.bubble}>{item.text}</div>
            </div>
          ),
        )}
        <div ref={feedEndRef} />
      </div>

      <form className={styles.composer} onSubmit={onSend}>
        <input
          ref={inputRef}
          className={styles.input}
          aria-label="Message the assistant"
          placeholder="e.g. Close my contest"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? 'Working…' : 'Send'}
        </Button>
      </form>

      {pending ? <ConfirmDialog action={pending.action} onConfirm={() => void onConfirm()} onCancel={onCancel} /> : null}
    </main>
  );
}

/**
 * The destructive-action confirmation card (design.md §7.1). A focus-trapped
 * modal: focus moves to it on open, Tab cycles within it, and Escape cancels —
 * nothing runs until the host accepts.
 */
function ConfirmDialog({
  action,
  onConfirm,
  onCancel,
}: {
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

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
          <span aria-hidden="true">⚠</span> Confirm
        </h2>
        <p id="confirm-body" className={styles.cardBody}>
          The assistant wants to <span className={styles.cardDetail}>{labelFor(action)}</span>. This can’t be undone.
        </p>
        <div className={styles.cardActions}>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            Yes, do it
          </Button>
        </div>
      </div>
    </div>
  );
}
