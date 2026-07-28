import type { DatabaseSync } from 'node:sqlite';

/**
 * Runs a piece of work as one all-or-nothing database transaction.
 *
 * Deleting a contest is the reason this exists: it spans five tables plus the
 * audit log, none of which cascade, and a failure part-way through would leave a
 * contest whose votes had been destroyed but whose row survived — or worse, a
 * history erased with no tombstone written in its place. Either half-state is
 * unrecoverable, so the whole thing commits or none of it does.
 *
 * The use case takes this as a collaborator rather than each repository opening
 * its own transaction, which would give one transaction per table and defeat the
 * point.
 */
export interface UnitOfWork {
  run<T>(work: () => T): T;
}

export class SqliteUnitOfWork implements UnitOfWork {
  constructor(private readonly db: DatabaseSync) {}

  run<T>(work: () => T): T {
    this.db.exec('BEGIN;');
    try {
      const result = work();
      this.db.exec('COMMIT;');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK;');
      throw error;
    }
  }
}

/** A pass-through for unit tests, where the fakes have no transaction to join. */
export class DirectUnitOfWork implements UnitOfWork {
  run<T>(work: () => T): T {
    return work();
  }
}
