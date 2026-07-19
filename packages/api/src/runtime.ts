import { randomUUID } from 'node:crypto';
import type { Clock, IdGenerator } from './audit/audit-projection.js';

/** Wall-clock, ISO-8601. Injected so tests can use a fixed clock. */
export class SystemClock implements Clock {
  now(): string {
    return new Date().toISOString();
  }
}

/** Random ids. Injected so tests can use deterministic ids. */
export class UuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
