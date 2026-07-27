import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Button } from '@tapas/ui';
import {
  confirmAssistantAction,
  sendAssistantMessage,
  type AssistantMessage,
  type AssistantTurn,
  type PendingAction,
} from '../api/client';
import styles from './chat.module.css';

// Known actions have a fixed, human phrasing (translated fixed UI); anything else
// falls back to the raw action name made readable — that fallback is data, not chrome.
const ACTION_KEYS = new Set(['close_contest', 'publish_contest', 'trigger_reveal']);
const labelFor = (action: string, t: TFunction) =>
  ACTION_KEYS.has(action) ? t(`chat.action.${action}`) : action.replace(/_/g, ' ');

function resultSummary(action: string, result: unknown, t: TFunction): string {
  const status =
    result && typeof result === 'object' && 'status' in result
      ? String((result as { status: unknown }).status)
      : undefined;
  return status
    ? t('chat.resultNow', { action: labelFor(action, t), status })
    : t('chat.resultDone', { action: labelFor(action, t) });
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
function readDetails(result: unknown, t: TFunction): { details?: ContestDetails; candidates?: ContestRow[] } {
  if (!result || typeof result !== 'object') return {};
  const record = result as Record<string, unknown>;
  const candidates = contestRows(record.candidates, t);
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
function contestRows(result: unknown, t: TFunction): ContestRow[] | null {
  if (!Array.isArray(result)) return null;
  return result.map((row) => {
    const record = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return {
      name: typeof record.name === 'string' ? record.name : t('chat.unnamedContest'),
      status: typeof record.status === 'string' ? record.status : '',
    };
  });
}

/** A one-line recap of a contest list, kept in the conversation so the model has context. */
function summariseRows(rows: ContestRow[], t: TFunction): string {
  if (rows.length === 0) return t('chat.contestsRecapEmpty');
  const list = rows.map((r) => `${r.name} (${r.status})`).join(', ');
  return t('chat.contestsRecap', { list });
}

/** A one-line recap of a contest's details, kept in the conversation for context. */
function detailsSummary(details: ContestDetails, t: TFunction): string {
  const who = details.participants.length ? details.participants.join(', ') : t('chat.recapNoOne');
  const cats = details.categories.length ? details.categories.join(', ') : t('chat.recapNoCategories');
  return t('chat.detailsRecap', { name: details.name, status: details.status, who, cats });
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
  const { t } = useTranslation();
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
      const text = turn.text.trim() || t('chat.nudge');
      add({ kind: 'assistant', text });
      setHistory((h) => [...h, { role: 'assistant', content: text }]);
    } else if (turn.kind === 'result' && DETAILS_ACTIONS.has(turn.action)) {
      // Details resolve to one contest, or to candidates when a name is shared.
      const { details, candidates } = readDetails(turn.result, t);
      if (details) {
        add({ kind: 'details', details });
        setHistory((h) => [...h, { role: 'assistant', content: detailsSummary(details, t) }]);
      } else if (candidates && candidates.length > 0) {
        add({ kind: 'note', text: t('chat.severalWhichOne') });
        add({ kind: 'contests', rows: candidates });
        setHistory((h) => [...h, { role: 'assistant', content: t('chat.severalRecap') }]);
      } else {
        // Adding/removing works on a draft; the details tool works on any contest.
        const text =
          turn.action === 'get_contest_details' ? t('chat.noContestByName') : t('chat.noDraftByName');
        add({ kind: 'note', text });
        setHistory((h) => [...h, { role: 'assistant', content: text }]);
      }
    } else if (turn.kind === 'result') {
      const rows = CONTEST_LIST_ACTIONS.has(turn.action) ? contestRows(turn.result, t) : null;
      if (rows) {
        // A read tool's answer IS its data — render the contests, not a "done" ticket.
        if (rows.length === 0) {
          add({
            kind: 'note',
            text: turn.action === 'find_contest' ? t('chat.noContestByName') : t('chat.noContestsYet'),
          });
        } else {
          add({ kind: 'contests', rows });
        }
        if (turn.text) add({ kind: 'assistant', text: turn.text });
        setHistory((h) => [...h, { role: 'assistant', content: turn.text || summariseRows(rows, t) }]);
      } else {
        add({ kind: 'ticket', text: resultSummary(turn.action, turn.result, t) });
        if (turn.text) add({ kind: 'assistant', text: turn.text });
        setHistory((h) => [
          ...h,
          { role: 'assistant', content: turn.text || t('chat.doneRecap', { action: labelFor(turn.action, t) }) },
        ]);
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
      add({ kind: 'note', text: t('chat.errorGeneric') });
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
      add({ kind: 'note', text: t('chat.errorCarryingOut') });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function onCancel() {
    setPending(null);
    add({ kind: 'note', text: t('chat.cancelled') });
    setHistory((h) => [...h, { role: 'assistant', content: t('chat.cancelled') }]);
    inputRef.current?.focus();
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>{t('common.brand')}</b>
        </div>
        <Link to="/" className={styles.back}>
          {t('chat.back')}
        </Link>
      </div>

      <h1 className={styles.title}>{t('chat.title')}</h1>
      <p className={styles.lead}>{t('chat.lead')}</p>

      <div className={styles.feed} role="log" aria-label={t('chat.conversationLabel')} aria-live="polite">
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
                <dt className={styles.detailsTerm}>{t('chat.takingPart')}</dt>
                <dd className={styles.detailsValue}>
                  {item.details.participants.length ? item.details.participants.join(', ') : t('chat.noOneYet')}
                </dd>
                <dt className={styles.detailsTerm}>{t('chat.scoredOn')}</dt>
                <dd className={styles.detailsValue}>
                  {item.details.categories.length ? item.details.categories.join(', ') : t('chat.noCategoriesYet')}
                </dd>
              </dl>
            </div>
          ) : item.kind === 'contests' ? (
            <ul key={item.id} className={styles.contestList} aria-label={t('chat.contestsLabel')}>
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
          aria-label={t('chat.composerLabel')}
          placeholder={t('chat.composerPlaceholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" disabled={busy || !input.trim()}>
          {busy ? t('chat.working') : t('chat.send')}
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
  const { t } = useTranslation();
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
          <span aria-hidden="true">⚠</span> {t('chat.confirmTitle')}
        </h2>
        <p id="confirm-body" className={styles.cardBody}>
          {t('chat.confirmBodyLead')} <span className={styles.cardDetail}>{labelFor(action, t)}</span>
          {t('chat.confirmBodyTail')}
        </p>
        <div className={styles.cardActions}>
          <Button variant="ghost" onClick={onCancel}>
            {t('chat.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            {t('chat.confirmYes')}
          </Button>
        </div>
      </div>
    </div>
  );
}
