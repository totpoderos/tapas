import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { DataTable, EmptyState } from '@tapas/ui';
import { ApiError, getAuditLog, type AuditEntry } from '../api/client';
import { SOURCE_MARK, eventKeyFor } from '../contests/audit-event';
import { whenHappened } from '../contests/when';
import styles from './audit-log.module.css';

// How events are named and sources marked is shared with the control room's
// recent activity — see `contests/audit-event`. An unknown type falls back to its
// raw value (data), never a missing-key blank.

type Source = 'all' | AuditEntry['sourcePath'];

/** The filter's choices, in the order the design draws them. */
const SOURCES: readonly Source[] = ['all', 'form', 'mcp', 'system'];

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
 *
 * The brand bar, the title's own back link and the contest's name are the shell's
 * now; what is left here is the log itself.
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
          {/*
           * Offered even when there is nothing to filter, so that narrowing to a
           * source and finding it empty is a state the host can get back out of.
           */}
          <SourceFilter value={source} onChange={setSource} />

          {state.entries.length === 0 ? (
            /* Nothing has ever happened here — a different thing entirely from
               nothing having happened *through this source*, and said differently
               so a host does not read one as the other. */
            <EmptyState lead={t('auditLog.nothingYet')} note={t('auditLog.nothingYetNote')} />
          ) : shown.length === 0 ? (
            <EmptyState lead={t('auditLog.empty')} note={t('auditLog.emptyNote')} />
          ) : (
            <Entries entries={shown} />
          )}
        </>
      )}
    </main>
  );
}

/**
 * How the log is narrowed: one choice of four, so it is a radio group and says so.
 *
 * The radio stays visible inside its chip. A segmented control that hides its
 * input is one only a mouse aiming at a label can operate — the lesson slice E
 * paid for.
 */
function SourceFilter({
  value,
  onChange,
}: {
  value: Source;
  onChange: (next: Source) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className={styles.filter}>
      <legend className={styles.filterLabel}>{t('auditLog.filterLabel')}</legend>
      <div className={styles.chips}>
        {SOURCES.map((option) => (
          <label
            key={option}
            className={`${styles.chip} ${value === option ? styles.chosen : ''}`}
          >
            <input
              type="radio"
              name="source"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {option === 'all' ? (
              t('auditLog.sourceAll')
            ) : (
              <>
                <span aria-hidden="true">{SOURCE_MARK[option]}</span>
                {t(`auditLog.source.${option}`)}
              </>
            )}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** What happened, how it was triggered, who did it, and when — one row each. */
function Entries({ entries }: { entries: readonly AuditEntry[] }) {
  const { t, i18n } = useTranslation();
  return (
    <DataTable label={t('auditLog.listLabel')}>
      <thead>
        <tr>
          <th scope="col">{t('auditLog.column.event')}</th>
          <th scope="col">{t('auditLog.column.source')}</th>
          <th scope="col">{t('auditLog.column.actor')}</th>
          <th scope="col">{t('auditLog.column.when')}</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <Entry key={entry.id} entry={entry} language={i18n.language} />
        ))}
      </tbody>
    </DataTable>
  );
}

function Entry({ entry, language }: { entry: AuditEntry; language: string }) {
  const { t } = useTranslation();
  const eventKey = eventKeyFor(entry.type);
  const eventLabel = eventKey ? t(`auditLog.event.${eventKey}`) : entry.type;
  const actor = t(entry.actorId === 'system' ? 'auditLog.actorSystem' : 'auditLog.actorYou');
  return (
    <tr>
      <td>
        <span className={styles.event}>{eventLabel}</span>
        {entry.confirmation === 'host' && (
          <span className={`${styles.badge} ${styles.confirmed}`}>
            <span aria-hidden="true">✓</span> {t('auditLog.confirmed')}
          </span>
        )}
        {entry.toolName && entry.toolArgs != null ? (
          <div className={styles.tool}>{JSON.stringify(entry.toolArgs)}</div>
        ) : null}
      </td>
      <td>
        {/* Word first, shape beside it: how an action was triggered is never told
            by colour alone (WCAG 1.4.1). */}
        <span className={`${styles.badge} ${styles[entry.sourcePath]}`}>
          <span aria-hidden="true">{SOURCE_MARK[entry.sourcePath]}</span>{' '}
          {t(`auditLog.source.${entry.sourcePath}`)}
        </span>
      </td>
      <td>
        {actor}
        {entry.toolName && <span className={styles.toolName}>{entry.toolName}</span>}
      </td>
      <td className={styles.when}>{whenHappened(entry.occurredAt, language)}</td>
    </tr>
  );
}
