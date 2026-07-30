import { describe, expect, it } from 'vitest';
import type { AuditEntry } from '@tapas/shared';
import { auditCsv, auditFilename, csvField } from '../../../src/audit/audit-csv.js';

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
  id: 'a1',
  contestId: 'c1',
  actorId: 'host-1',
  type: 'contest.closed',
  sourcePath: 'form',
  occurredAt: '2026-07-21T10:00:00.000Z',
  ...over,
});

/** The rows of a document, without the heading or the trailing break. */
const rowsOf = (csv: string) => csv.trimEnd().split('\r\n').slice(1);

describe('a field a spreadsheet might run', () => {
  /*
   * OWASP A03. Audit entries carry `toolName` and `toolArgs` that originate
   * from an assistant — i.e. from participant-influenced text — so this is a
   * live path in this app, not a theoretical one.
   */
  it.each(['=1+1', '+1', '-1', '@SUM(A1)', '\tcmd', '\rcmd'])(
    'makes %j inert with a leading apostrophe',
    (dangerous) => {
      expect(csvField(dangerous).replace(/^"/, '').startsWith("'")).toBe(true);
    },
  );

  it('leaves an ordinary value alone', () => {
    expect(csvField('contest.closed')).toBe('contest.closed');
    expect(csvField('Ana')).toBe('Ana');
  });

  it('does not treat a minus inside a value as a formula', () => {
    // Only the *leading* character decides; an ISO timestamp is full of hyphens.
    expect(csvField('2026-07-21T10:00:00.000Z')).toBe('2026-07-21T10:00:00.000Z');
  });

  it('puts the apostrophe inside the quotes when the value also needs quoting', () => {
    /*
     * Escape first, quote second. The other order would leave the apostrophe
     * outside the quotes and the row would no longer parse.
     */
    expect(csvField('=1,2')).toBe('"\'=1,2"');
  });
});

describe('a field carrying a separator or a quote', () => {
  it('quotes a value holding a comma', () => {
    expect(csvField('Taste, presentation')).toBe('"Taste, presentation"');
  });

  it('doubles the quotes inside a quoted value', () => {
    expect(csvField('the "best" tapa')).toBe('"the ""best"" tapa"');
  });

  it('quotes a value holding a line break, so the row stays one row', () => {
    expect(csvField('two\nlines')).toBe('"two\nlines"');
    expect(csvField('two\r\nlines')).toBe('"two\r\nlines"');
  });
});

describe('the log as a file', () => {
  it('heads the columns the screen shows, in the screen’s order', () => {
    expect(auditCsv([]).trimEnd()).toBe('event,source,actor,confirmed,when,details');
  });

  it('writes a row per entry, in the order given', () => {
    const csv = auditCsv([
      entry({ id: '1', type: 'draft.saved' }),
      entry({ id: '2', type: 'contest.published', sourcePath: 'system' }),
    ]);
    const rows = rowsOf(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('draft.saved');
    expect(rows[1]).toContain('contest.published');
  });

  it('says how the action was triggered, who acted, and when', () => {
    const [row] = rowsOf(auditCsv([entry()]));
    expect(row).toBe('contest.closed,form,host-1,,2026-07-21T10:00:00.000Z,');
  });

  it('carries the detail the screen shows under an entry', () => {
    const [row] = rowsOf(
      auditCsv([entry({ sourcePath: 'mcp', toolName: 'update_draft', toolArgs: { name: 'Otoño' } })]),
    );
    expect(row).toContain('Otoño');
  });

  it('carries a host’s own contest name safely when it begins like a formula', () => {
    /*
     * A host can ask the assistant to name a contest `=SUM(A1)`, and
     * `update_draft` carries that straight into the recorded arguments. The
     * field a spreadsheet sees is the JSON object, so it begins `{` and is read
     * as text — the leading-character guard is what stands behind that, for the
     * day a column carries a bare value instead.
     */
    const csv = auditCsv([
      entry({ sourcePath: 'mcp', toolName: 'update_draft', toolArgs: { name: '=SUM(A1)' } }),
    ]);
    expect(rowsOf(csv)).toHaveLength(1);
    // Quoted and its quotes doubled, so the row still parses back to one row.
    expect(csv).toContain('"{""name"":""=SUM(A1)""}"');
  });

  it('keeps a bare value a spreadsheet cannot run', () => {
    /*
     * Worth being exact about: no column *can* begin with a formula character
     * today. Every one is either a fixed vocabulary (event, source, confirmed),
     * a generated value (actor, when), or JSON — and `JSON.stringify` wraps a
     * string in quotes, so even a bare `=SUM(A1)` arrives as `"=SUM(A1)"`. The
     * guard in `csvField` is tested directly, above, and stands behind the day
     * a column carries something raw.
     */
    const [row] = rowsOf(auditCsv([entry({ toolArgs: '=SUM(A1)' })]));
    expect(row!.endsWith(',"""=SUM(A1)"""')).toBe(true);
  });

  it('records a host confirmation, and leaves an automatic one blank', () => {
    const [confirmed] = rowsOf(auditCsv([entry({ confirmation: 'host' })]));
    expect(confirmed!.split(',')[3]).toBe('host');

    // 'auto' means nobody was asked, which is not the same as a host agreeing.
    const [automatic] = rowsOf(auditCsv([entry({ confirmation: 'auto' })]));
    expect(automatic!.split(',')[3]).toBe('');
  });

  it('names the tool an assistant acted through, beside the actor', () => {
    const [row] = rowsOf(
      auditCsv([entry({ sourcePath: 'mcp', toolName: 'close_contest' })]),
    );
    expect(row).toContain('host-1 (close_contest)');
  });

  it('ends every line the way a CSV reader expects', () => {
    expect(auditCsv([entry()]).endsWith('\r\n')).toBe(true);
  });

  it('keeps a row one row even when a tool name arrives full of punctuation', () => {
    // The tool name comes from an assistant, so it is not the app's to trust.
    const csv = auditCsv([
      entry({ sourcePath: 'mcp', toolName: 'evil",\n=cmd|calc' }),
    ]);
    expect(rowsOf(csv)).toHaveLength(1);
    expect(csv).toContain('""');
  });
});

describe('what the file is called', () => {
  it('is named after the contest', () => {
    expect(auditFilename('Spring Tapas Crawl')).toBe('Spring-Tapas-Crawl-activity-log.csv');
  });

  it('keeps a name with accents readable rather than dropping it', () => {
    expect(auditFilename('Sobremesá Otoño')).toBe('Sobremesa-Otono-activity-log.csv');
  });

  it('gives a name made only of punctuation something to be called', () => {
    expect(auditFilename('!!!')).toBe('contest-activity-log.csv');
    expect(auditFilename('')).toBe('contest-activity-log.csv');
  });

  it('cannot be made to forge the header it goes into', () => {
    /*
     * The name is the host's and can hold anything. Quotes, semicolons and
     * newlines would all be ways to write a second header field.
     */
    const forged = auditFilename('a";\r\nSet-Cookie: x=1');
    expect(forged).toMatch(/^[a-zA-Z0-9-]+-activity-log\.csv$/);
  });

  it('does not run away with a very long name', () => {
    expect(auditFilename('x'.repeat(500)).length).toBeLessThanOrEqual(80);
  });
});
