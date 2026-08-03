import type { Database } from './database.js';
import type { Clock, IdGenerator } from '../audit/audit-projection.js';
import type {
  SecurityEvent,
  SecurityEventInput,
  SecurityEventLog,
} from '../security/security-event.js';

interface SecurityEventRow {
  id: string;
  type: string;
  actor_id: string | null;
  source_ip: string;
  reason: string | null;
  occurred_at: string;
}

function toEvent(row: SecurityEventRow): SecurityEvent {
  return {
    id: row.id,
    type: row.type as SecurityEvent['type'],
    actorId: row.actor_id,
    sourceIp: row.source_ip,
    reason: row.reason,
    occurredAt: row.occurred_at,
  };
}

/** Persists security events to `security_events`, stamping the id and timestamp at write time. */
export class SqliteSecurityEventLog implements SecurityEventLog {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async record(event: SecurityEventInput): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO security_events (id, type, actor_id, source_ip, reason, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        this.ids.next(),
        event.type,
        event.actorId,
        event.sourceIp,
        event.reason ?? null,
        this.clock.now(),
      );
  }

  async list(): Promise<SecurityEvent[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM security_events ORDER BY occurred_at`)
      .all() as unknown as SecurityEventRow[];
    return rows.map(toEvent);
  }
}
