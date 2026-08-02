import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { useContests } from '../contests/contests-provider';
import { whenLastChanged } from '../contests/when';
import { PanelActions } from '../shell/panel-actions';
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

/*
 * Tools that only ever act on a DRAFT. This is the one thing left that the shape
 * of an answer cannot say: an empty answer to `get_draft` means no *draft* by
 * that name, and looks exactly like an empty answer to `get_contest`, which
 * means no *contest*. It decides a noun, not a renderer — a tool missing from
 * here still gets a truthful message, just the more general one.
 */
const DRAFT_ONLY_ACTIONS = new Set([
  'get_draft',
  'rename_contest',
  'publish_contest',
  'add_participant',
  'remove_participant',
]);
const STATUS_MARK: Record<string, string> = { live: '●', draft: '◇', closed: '◆', revealed: '✓' };

interface ContestRow {
  readonly name: string;
  readonly status: string;
  /**
   * What tells this contest apart from another of the same name — the join code
   * a host already has on screen, or failing that when it last changed.
   *
   * Not decoration. Asking "which one?" and then listing two rows that read
   * identically is not a question a host can answer; it is the same dead end as
   * not asking. This is the field that makes the asking worth doing.
   */
  readonly apart?: string;
}

interface ContestDetails {
  readonly name: string;
  readonly status: string;
  readonly participants: readonly string[];
  readonly categories: readonly string[];
  /** Who is paired with whom, each pair named once. Absent when nobody is paired. */
  readonly pairs?: readonly (readonly [string, string])[];
}

/**
 * What a tool's answer *is*, read from the answer itself.
 *
 * The panel used to choose how to draw a result from the name of the tool that
 * produced it, which meant a table of tool names kept beside the catalogue — a
 * second catalogue, free to fall behind the first. When it did, a real change
 * rendered as a bare "done" ticket, or worse, an action that never happened
 * rendered as one that did.
 *
 * So the answer says what it is. Each shape is told by a field only it has, and
 * anything unrecognised falls back to the plain ticket — which is terse but
 * true, and is what a new tool gets for free until someone gives it a nicer
 * rendering.
 */
type ResultShape =
  | { readonly kind: 'contests'; readonly rows: readonly ContestRow[] }
  | { readonly kind: 'details'; readonly details: ContestDetails }
  | { readonly kind: 'unresolved'; readonly candidates: readonly ContestRow[] }
  | { readonly kind: 'done' };

function shapeOf(result: unknown, t: TFunction, language: string): ResultShape {
  const rows = contestRows(result, t, language);
  if (rows) return { kind: 'contests', rows };

  if (!result || typeof result !== 'object') return { kind: 'done' };
  const record = result as Record<string, unknown>;

  if (record.details && typeof record.details === 'object') {
    const d = record.details as Record<string, unknown>;
    return {
      kind: 'details',
      details: {
        name: typeof d.name === 'string' ? d.name : '',
        status: typeof d.status === 'string' ? d.status : '',
        participants: Array.isArray(d.participants) ? d.participants.map(String) : [],
        categories: Array.isArray(d.categories) ? d.categories.map(String) : [],
        ...(Array.isArray(d.pairs) ? { pairs: readPairs(d.pairs) } : {}),
      },
    };
  }

  /*
   * `candidates` means the name the host said is not one contest, so whatever
   * they asked for did not happen — with entries when they have reused a name,
   * and empty when no contest has it. Every tool can answer this way now, which
   * is exactly why it must be read from the answer and not from a list of which
   * tools might.
   */
  const candidates = contestRows(record.candidates, t, language);
  if (candidates) return { kind: 'unresolved', candidates };

  return { kind: 'done' };
}

/** Reads the pairings defensively — anything that is not two names is dropped. */
function readPairs(raw: readonly unknown[]): readonly (readonly [string, string])[] {
  return raw.flatMap((pair) =>
    Array.isArray(pair) && pair.length === 2 ? [[String(pair[0]), String(pair[1])] as const] : [],
  );
}

/**
 * What to say when the answer is empty. This is the one choice the shape cannot
 * make: an empty answer looks the same whether the host asked for a draft, a
 * contest, or their whole list — only the question told them apart.
 */
function emptyAnswerText(action: string, t: TFunction): string {
  if (action === 'list_my_contests') return t('chat.noContestsYet');
  return DRAFT_ONLY_ACTIONS.has(action) ? t('chat.noDraftByName') : t('chat.noContestByName');
}

/**
 * Reads a contest list out of a tool result — null if it is not one.
 *
 * This now *decides* whether an answer is a list of contests, not merely how to
 * read one, so it has to be strict: every entry must actually look like a
 * contest. An array of something else drawn as a contest list would be a screen
 * full of "Unnamed contest", which is worse than the plain ticket it would
 * otherwise get. An empty array is still a list — an empty one.
 */
function contestRows(result: unknown, t: TFunction, language: string): ContestRow[] | null {
  if (!Array.isArray(result)) return null;
  const looksLikeContest = (row: unknown): boolean =>
    !!row && typeof row === 'object' && ('name' in row || 'status' in row);
  if (!result.every(looksLikeContest)) return null;

  return result.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : t('chat.unnamedContest'),
      status: typeof record.status === 'string' ? record.status : '',
      apart: tellsApart(record, t, language),
    };
  });
}

/**
 * The one detail that lets a host pick this contest out of several with the same
 * name. The join code first — it is the thing they already have on screen and
 * read out to the room — and when there is none (a draft has none yet), when it
 * was last changed, which is what separates this year's "Tapas Night" from last
 * year's.
 */
function tellsApart(record: Record<string, unknown>, t: TFunction, language: string): string | undefined {
  if (typeof record.joinCode === 'string' && record.joinCode !== '') {
    return t('chat.contestCode', { code: record.joinCode });
  }
  if (typeof record.updatedAt === 'string') {
    const when = whenLastChanged(record.updatedAt, language);
    if (when) return t('chat.contestChanged', { when });
  }
  return undefined;
}

/**
 * A one-line recap of a contest list, kept in the conversation so the model has
 * context. It carries what tells the contests apart for the same reason the
 * screen does: the host answers "which one?" by naming that detail back, and a
 * recap of two identical-looking rows leaves the model unable to act on the
 * answer it just asked for.
 */
function summariseRows(rows: readonly ContestRow[], t: TFunction): string {
  if (rows.length === 0) return t('chat.contestsRecapEmpty');
  const list = rows.map((r) => `${r.name} (${[r.apart, r.status].filter(Boolean).join(', ')})`).join('; ');
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
  | { readonly id: number; readonly kind: 'refusal'; readonly text: string }
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
  const { t, i18n } = useTranslation();
  const { refresh: refreshContests } = useContests();
  const initial = useMemo(loadChat, []);
  const [feed, setFeed] = useState<readonly Feed[]>(initial.feed);
  const [history, setHistory] = useState<readonly AssistantMessage[]>(initial.history);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [announcement, setAnnouncement] = useState('');
  // Bumped on every clear. A turn captures it before awaiting and drops its
  // answer if it no longer matches — otherwise a reply already in flight lands
  // in the conversation the host has just cleared.
  const conversation = useRef(0);
  const nextId = useRef(initial.feed.reduce((max, item) => Math.max(max, item.id + 1), 0));
  const inputRef = useRef<HTMLInputElement>(null);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const add = (item: FeedInput) => setFeed((f) => [...f, { ...item, id: nextId.current++ } as Feed]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView?.({ block: 'end' });
  }, [feed, pending]);

  // Persist the conversation so it survives navigating away and back, or a reload.
  // An empty conversation REMOVES the key rather than storing emptiness, so a
  // cleared panel and a never-used one are the same state — and so this effect,
  // which runs after a clear, cannot write the conversation back.
  useEffect(() => {
    try {
      if (feed.length === 0 && history.length === 0) sessionStorage.removeItem(CHAT_STORAGE_KEY);
      else sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ feed, history }));
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

  /**
   * What the assistant answered. One message may ask for several things, so an
   * answer may be a run of steps — each drawn exactly as it would be on its own,
   * in the order the host asked for it.
   */
  function applyTurn(turn: AssistantTurn) {
    if (turn.kind === 'steps') {
      /*
       * Only the last result is drawn in full. Every step of "create Tapas,
       * judge it on two things, add three people" answers with the whole draft
       * as it then stood, so drawing each one gives the host six near-identical
       * cards differing by a line, with the state they actually want buried at
       * the bottom looking like the five above it. The steps before it say what
       * they did in a line; the run ends with the contest as it now stands.
       */
      /*
       * Once for the whole run. A step drawn as a ticket skips the branch below
       * that re-reads the contest list, so without this the panel went on saying
       * a host had no contests straight after making them one.
       */
      if (turn.steps.some((step) => step.kind === 'result')) refreshContests();

      const lastResult = turn.steps.findLastIndex((step) => step.kind === 'result');
      turn.steps.forEach((step, index) => {
        if (step.kind === 'result' && index !== lastResult) {
          add({ kind: 'ticket', text: resultSummary(step.action, step.result, t) });
          return;
        }
        applyTurn(step);
      });
      /*
       * What the run did not get to. A host who asked for six things and had the
       * run stop at the third must not be left assuming the other three
       * happened — that silent drop is the whole reason this exists.
       */
      if (turn.notReached.length > 0) {
        const text = t('chat.notReached', {
          actions: turn.notReached.map((action) => labelFor(action, t)).join(', '),
        });
        add({ kind: 'note', text });
        setHistory((h) => [...h, { role: 'assistant', content: text }]);
      }
      return;
    }
    if (turn.kind === 'reply') {
      // A small model sometimes returns an empty reply; show a nudge rather than
      // a blank bubble, so the host always gets a response.
      const text = turn.text.trim() || t('chat.nudge');
      add({ kind: 'assistant', text });
      setHistory((h) => [...h, { role: 'assistant', content: text }]);
    } else if (turn.kind === 'failed') {
      // The action did not happen. Say so, and say why — the API writes these
      // reasons for hosts, so they are shown rather than swallowed.
      const text = t('chat.failed', { action: labelFor(turn.action, t), reason: turn.message });
      add({ kind: 'refusal', text });
      // Fed back to the model too, so the next turn can react to the reason
      // instead of cheerfully repeating the same call.
      setHistory((h) => [...h, { role: 'assistant', content: text }]);
    } else if (turn.kind === 'result') {
      const shape = shapeOf(turn.result, t, i18n.language);

      if (shape.kind === 'details') {
        add({ kind: 'details', details: shape.details });
        setHistory((h) => [...h, { role: 'assistant', content: detailsSummary(shape.details, t) }]);
      } else if (shape.kind === 'unresolved') {
        /*
         * The name the host said is not one contest, so what they asked for did
         * not happen. Said as a note rather than a refusal on purpose: a refusal
         * means the thing was tried and could not be done, and a host reads the
         * two differently. This one is "you have two of those" or "you have none
         * of those" — a question to answer, not a failure to absorb.
         */
        if (shape.candidates.length > 0) {
          add({ kind: 'note', text: t('chat.severalWhichOne') });
          add({ kind: 'contests', rows: shape.candidates });
          setHistory((h) => [
            ...h,
            // The candidates go into the model's context too, told apart, so it can
            // act on whichever one the host names back.
            { role: 'assistant', content: `${t('chat.severalRecap')} ${summariseRows(shape.candidates, t)}` },
          ]);
        } else {
          const text = emptyAnswerText(turn.action, t);
          add({ kind: 'note', text });
          setHistory((h) => [...h, { role: 'assistant', content: text }]);
        }
      } else if (shape.kind === 'contests') {
        // A read tool's answer IS its data — render the contests, not a "done" ticket.
        const { rows } = shape;
        if (rows.length === 0) add({ kind: 'note', text: emptyAnswerText(turn.action, t) });
        else add({ kind: 'contests', rows });
        if (turn.text) add({ kind: 'assistant', text: turn.text });
        setHistory((h) => [
          ...h,
          { role: 'assistant', content: turn.text || summariseRows(rows, t) },
        ]);
      } else {
        /*
         * The assistant has just changed something. The shared contest list has
         * to be re-read, or the panel goes on saying a contest it has closed is
         * live — the same staleness the control room's own actions already
         * refresh away. The assistant is a second path to the same changes, and
         * this is the layer where the two would otherwise diverge.
         */
        refreshContests();
        add({ kind: 'ticket', text: resultSummary(turn.action, turn.result, t) });
        // A small model often calls a tool and says nothing at all. Rather than
        // leave a bare ticket, put what happened into words — the same sentence
        // that goes to the model's history, so screen and history agree.
        const said = turn.text.trim();
        const sentence = said || t('chat.doneRecap', { action: labelFor(turn.action, t) });
        add({ kind: 'assistant', text: sentence });
        setHistory((h) => [...h, { role: 'assistant', content: sentence }]);
      }
    } else {
      add({ kind: 'assistant', text: turn.message });
      setPending({ action: turn.action, args: turn.args, confirmationToken: turn.confirmationToken });
    }
  }

  /**
   * Puts the conversation down: what is on screen, the history the assistant is
   * given on every turn, and the copy kept for coming back to the panel.
   *
   * One function on purpose. Clearing the feed alone looks perfectly correct and
   * leaves the model reading the old exchange for the rest of the session, so the
   * three must never be reset from separate places.
   *
   * An action the host was midway through approving goes with it — its
   * confirmation token is live, and approving from an emptied screen would mean
   * approving something whose reasoning is no longer visible.
   */
  function clearConversation() {
    conversation.current += 1;
    setFeed([]);
    setHistory([]);
    setPending(null);
    setInput('');
    setAnnouncement(t('chat.cleared'));
    inputRef.current?.focus();
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    add({ kind: 'user', text });
    const nextHistory = [...history, { role: 'user' as const, content: text }];
    setHistory(nextHistory);
    setInput('');
    setAnnouncement('');
    setBusy(true);
    const sentIn = conversation.current;
    try {
      const turn = await sendAssistantMessage(nextHistory);
      if (sentIn !== conversation.current) return; // cleared while this was in flight
      applyTurn(turn);
    } catch {
      if (sentIn !== conversation.current) return;
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
    const sentIn = conversation.current;
    try {
      const turn = await confirmAssistantAction(action);
      if (sentIn !== conversation.current) return;
      applyTurn(turn);
    } catch {
      if (sentIn !== conversation.current) return;
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
    // `data-fills-height` tells the shell this screen is exactly the panel's
    // height and scrolls inside itself, so the surface drops the bottom padding
    // that would otherwise strand the composer above the panel's foot.
    <main id="main" data-fills-height className={styles.page}>
      {/* Clearing belongs to this surface, so it sits in the panel's header
          beside the breadcrumb rather than competing with the composer. */}
      <PanelActions>
        <Button
          variant="ghost"
          onClick={clearConversation}
          disabled={feed.length === 0 && !pending}
        >
          {t('chat.clear')}
        </Button>
      </PanelActions>

      <div className={styles.head}>
        <span className={styles.dot} aria-hidden="true" />
        <h1 className={styles.title}>{t('chat.title')}</h1>
        {/*
         * Not decoration: what the assistant does really is recorded as having
         * come through a connected tool, and the activity log can be narrowed to
         * exactly these actions. The badge says which of the two the host is
         * about to leave a trace as.
         */}
        <span className={styles.connected}>{t('chat.connectedTool')}</span>
      </div>
      <p className={styles.lead}>{t('chat.lead')}</p>

      {/* Outside the feed on purpose: emptying a live region announces nothing,
          and a line inside the feed would contradict a cleared conversation. */}
      <p role="status" className={styles.announcement}>
        {announcement}
      </p>

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
                {/* Only where there is a pairing to show. A contest that keeps
                    nobody apart has no row here rather than an empty one. */}
                {item.details.pairs?.length ? (
                  <>
                    <dt className={styles.detailsTerm}>{t('chat.pairedUp')}</dt>
                    <dd className={styles.detailsValue}>
                      {item.details.pairs.map(([one, other]) => t('chat.pair', { one, other })).join(', ')}
                    </dd>
                  </>
                ) : null}
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
                  {/* What tells two contests of the same name apart — without it
                      "which one?" is a question the host cannot answer. */}
                  {row.apart ? <span className={styles.contestApart}>{row.apart}</span> : null}
                  <span className={styles.contestStatus}>{row.status}</span>
                </li>
              ))}
            </ul>
          ) : item.kind === 'refusal' ? (
            <p key={item.id} className={styles.refusal} role="alert">
              <span aria-hidden="true">✕</span> {item.text}
            </p>
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
          {t('chat.confirmTitle')}
        </h2>
        <p id="confirm-body" className={styles.cardBody}>
          {t('chat.confirmBodyLead')} <b className={styles.cardDetail}>{labelFor(action, t)}</b>
          {t('chat.confirmBodyTail')}
        </p>
        <div className={styles.cardActions}>
          {/*
           * Cancel first — the mockup draws agreeing first, and that is not
           * followed. Focus opens on whatever comes first here, and opening it on
           * the button that closes a contest means a stray Enter does the thing
           * the card exists to prevent. Reordering visually with CSS would only
           * move the problem: tab order would then disagree with reading order
           * (WCAG 2.4.3). So the safe default keeps both.
           */}
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
