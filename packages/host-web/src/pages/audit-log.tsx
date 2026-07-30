import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { ApiError, getAuditLog, type AuditEntry } from '../api/client';
import { SOURCE_MARK, eventKeyFor } from '../contests/audit-event';
import styles from './audit-log.module.css';

// How events are named and sources marked is shared with the control room's
// recent activity — see `contests/audit-event`. An unknown type falls back to its
// raw value (data), never a missing-key blank.

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
  const { t } = useTranslation();
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
          <b>{t('common.brand')}</b>
        </div>
        <Link to="/" className={styles.back}>
          {t('auditLog.back')}
        </Link>
      </div>

      <h1 className={styles.title}>{t('auditLog.title')}</h1>
      <p className={styles.lead}>{t('auditLog.lead')}</p>

      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          {t('auditLog.loading')}
        </p>
      )}
      {state.kind === 'missing' && <p className={styles.note}>{t('auditLog.missing')}</p>}
      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          {t('auditLog.error')}
        </p>
      )}

      {state.kind === 'ready' && (
        <>
          <div className={styles.filter}>
            <label htmlFor="source-filter">{t('auditLog.filterLabel')}</label>
            <select
              id="source-filter"
              value={source}
              onChange={(e) => setSource(e.target.value as Source)}
            >
              <option value="all">{t('auditLog.sourceAll')}</option>
              <option value="form">{t('auditLog.source.form')}</option>
              <option value="system">{t('auditLog.source.system')}</option>
              <option value="mcp">{t('auditLog.source.mcp')}</option>
            </select>
          </div>

          {shown.length === 0 ? (
            <p className={styles.note}>{t('auditLog.empty')}</p>
          ) : (
            <ul className={styles.list} aria-label={t('auditLog.listLabel')}>
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
  const { t } = useTranslation();
  const eventKey = eventKeyFor(entry.type);
  const eventLabel = eventKey ? t(`auditLog.event.${eventKey}`) : entry.type;
  const actor = t(entry.actorId === 'system' ? 'auditLog.actorSystem' : 'auditLog.actorYou');
  return (
    <li className={styles.entry}>
      <span className={styles.event}>{eventLabel}</span>
      <span className={styles.when}>{new Date(entry.occurredAt).toLocaleString()}</span>
      <div className={styles.meta}>
        <span className={`${styles.badge} ${styles[entry.sourcePath]}`}>
          <span aria-hidden="true">{SOURCE_MARK[entry.sourcePath]}</span> {t(`auditLog.source.${entry.sourcePath}`)}
        </span>
        {entry.confirmation === 'host' && (
          <span className={`${styles.badge} ${styles.confirmed}`}>
            <span aria-hidden="true">✓</span> {t('auditLog.confirmed')}
          </span>
        )}
        <span>
          {t('auditLog.by', { actor })}
          {entry.toolName ? ` · ${entry.toolName}` : ''}
        </span>
      </div>
      {entry.toolName && entry.toolArgs != null ? (
        <div className={styles.tool}>{JSON.stringify(entry.toolArgs)}</div>
      ) : null}
    </li>
  );
}
