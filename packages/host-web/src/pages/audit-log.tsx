import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, getAuditLog, type AuditEntry } from '../api/client';
import styles from './audit-log.module.css';

const EVENT_LABEL: Record<string, string> = {
  'draft.saved': 'Draft saved',
  'draft.updated': 'Draft renamed',
  'draft.discarded': 'Draft discarded',
  'contest.published': 'Contest published',
  'contest.closed': 'Contest closed',
  'contest.revealed': 'Results revealed',
};
const eventLabel = (type: string) => EVENT_LABEL[type] ?? type;

const SOURCE_LABEL: Record<AuditEntry['sourcePath'], { label: string; mark: string }> = {
  form: { label: 'In-app', mark: '◇' },
  system: { label: 'System', mark: '◈' },
  mcp: { label: 'Connected tool', mark: '⬡' },
};

type Source = 'all' | AuditEntry['sourcePath'];

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly entries: readonly AuditEntry[] }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error' };

/**
 * A contest's activity log: every action taken on it, in order, each with who
 * did it, when, and how it was triggered (design.md §5) — including whether a
 * destructive action was confirmed by the host (§7.1). The same log whatever the
 * path, because it is a projection of the contest's own events. Read-only, and
 * only ever the host's own.
 */
export function AuditLog() {
  const { id = '' } = useParams();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [source, setSource] = useState<Source>('all');

  useEffect(() => {
    let live = true;
    getAuditLog(id)
      .then((entries) => live && setState({ kind: 'ready', entries }))
      .catch((caught) => {
        if (!live) return;
        const missing = caught instanceof ApiError && (caught.status === 404 || caught.status === 403);
        setState(missing ? { kind: 'missing' } : { kind: 'error' });
      });
    return () => {
      live = false;
    };
  }, [id]);

  const shown = useMemo(() => {
    if (state.kind !== 'ready') return [];
    return source === 'all' ? state.entries : state.entries.filter((e) => e.sourcePath === source);
  }, [state, source]);

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

      <h1 className={styles.title}>Activity log</h1>
      <p className={styles.lead}>Everything that has happened to this contest, and how each action was triggered.</p>

      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          Loading the activity log…
        </p>
      )}
      {state.kind === 'missing' && <p className={styles.note}>This contest doesn’t exist, or isn’t yours to view.</p>}
      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          The activity log couldn’t be loaded. Please try again.
        </p>
      )}

      {state.kind === 'ready' && (
        <>
          <div className={styles.filter}>
            <label htmlFor="source-filter">Filter by source</label>
            <select
              id="source-filter"
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
            >
              <option value="all">All sources</option>
              <option value="form">In-app</option>
              <option value="system">System</option>
              <option value="mcp">Connected tool</option>
            </select>
          </div>

          {shown.length === 0 ? (
            <p className={styles.note}>No activity from this source yet.</p>
          ) : (
            <ul className={styles.list} aria-label="Activity">
              {shown.map((entry) => (
                <Entry key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

function Entry({ entry }: { entry: AuditEntry }) {
  const source = SOURCE_LABEL[entry.sourcePath];
  return (
    <li className={styles.entry}>
      <span className={styles.event}>{eventLabel(entry.type)}</span>
      <span className={styles.when}>{new Date(entry.occurredAt).toLocaleString()}</span>
      <div className={styles.meta}>
        <span className={`${styles.badge} ${styles[entry.sourcePath]}`}>
          <span aria-hidden="true">{source.mark}</span> {source.label}
        </span>
        {entry.confirmation === 'host' && (
          <span className={`${styles.badge} ${styles.confirmed}`}>
            <span aria-hidden="true">✓</span> You confirmed
          </span>
        )}
        <span>
          by {entry.actorId === 'system' ? 'the system' : 'you'}
          {entry.toolName ? ` · ${entry.toolName}` : ''}
        </span>
      </div>
      {entry.toolName && entry.toolArgs != null ? (
        <div className={styles.tool}>{JSON.stringify(entry.toolArgs)}</div>
      ) : null}
    </li>
  );
}
