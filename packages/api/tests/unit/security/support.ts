import type { SecurityEvent, SecurityEventInput, SecurityEventLog } from '../../../src/index.js';

export class FakeSecurityEventLog implements SecurityEventLog {
  private sequence = 0;
  private readonly events: SecurityEvent[] = [];

  async record(event: SecurityEventInput): Promise<void> {
    this.events.push({
      id: `sec-${++this.sequence}`,
      type: event.type,
      actorId: event.actorId,
      sourceIp: event.sourceIp,
      reason: event.reason ?? null,
      occurredAt: '2026-07-20T10:00:00.000Z',
    });
  }

  async list(): Promise<SecurityEvent[]> {
    return [...this.events];
  }
}
