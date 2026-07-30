import type { AuditEntry } from '@tapas/shared';

/**
 * Writes an audit log as a comma-separated file.
 *
 * It lives beside the projection rather than in the panel because the escaping
 * below is a property of the record, not of one way of looking at it — and
 * because the ownership rule that decides who may have the file already lives
 * on the route. Two copies of either would be two things to keep in step.
 *
 * The columns are the screen's, in the screen's order, so a host who exports
 * what they were just reading gets what they were just reading.
 */
const COLUMNS = ['event', 'source', 'actor', 'confirmed', 'when', 'details'] as const;

/**
 * Characters a spreadsheet reads as the start of a formula (OWASP A03, "CSV
 * injection"). Tab and carriage return are here because Excel strips leading
 * whitespace before deciding, so ` =cmd` is still a formula to it.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * One field, made safe to read.
 *
 * A leading formula character is neutralised with an apostrophe, which
 * spreadsheets consume as "this is text". Then the RFC 4180 rules: a field
 * holding a comma, a quote or a newline is wrapped in quotes, and its own
 * quotes are doubled.
 *
 * Order matters. Escaping first and quoting second means the apostrophe ends up
 * inside the quotes, where it belongs; the other way round it would be outside
 * them and the file would be malformed.
 */
export function csvField(value: string): string {
  const inert = FORMULA_LEAD.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(inert) ? `"${inert.replace(/"/g, '""')}"` : inert;
}

/**
 * The whole log as one CSV document.
 *
 * Values are written raw — the event type as recorded, the timestamp in
 * ISO-8601, the actor's id — rather than in the panel's words. The file is a
 * record, and a record that says "you" cannot be read by anyone but the host
 * who exported it; `en`/`es` phrasing would also make two files of one log.
 */
export function auditCsv(entries: readonly AuditEntry[]): string {
  const rows = entries.map((entry) =>
    [
      entry.type,
      entry.sourcePath,
      // The tool is who acted, when something acted through one.
      entry.toolName ? `${entry.actorId} (${entry.toolName})` : entry.actorId,
      // Only a host's confirmation is worth recording; 'auto' means nobody was asked.
      entry.confirmation === 'host' ? 'host' : '',
      entry.occurredAt,
      /*
       * What the tool was called with — the same detail the screen shows under
       * the entry, so the file is not a poorer record than the page it came
       * from. It is the one column carrying text the app did not choose:
       * `create_draft`/`update_draft` pass a host's own contest name through
       * here, so the *quoting* rules are load-bearing. The formula guard is not
       * reachable through this column — JSON wraps a string in quotes, so the
       * field begins `{` or `"` — and is defence for a column that carries
       * something raw later.
       */
      entry.toolArgs == null ? '' : JSON.stringify(entry.toolArgs),
    ]
      .map(csvField)
      .join(','),
  );
  // CRLF per RFC 4180, and a trailing break so the last row is a line.
  return [COLUMNS.join(','), ...rows].join('\r\n') + '\r\n';
}

/**
 * A filename for a contest's log, built from what the host called it.
 *
 * The name is theirs, so it can hold anything — quotes, semicolons, slashes,
 * non-Latin script, a leading dot. Everything outside a conservative set
 * becomes a hyphen, which keeps the file openable on any of the three desktop
 * platforms and keeps the header it goes into unforgeable.
 */
export function auditFilename(contestName: string): string {
  const stem =
    contestName
      .normalize('NFKD')
      // Combining marks dropped, so "Sobremesa" and "Sobremesá" do not become
      // different-looking files that sort apart.
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'contest';
  return `${stem}-activity-log.csv`;
}
