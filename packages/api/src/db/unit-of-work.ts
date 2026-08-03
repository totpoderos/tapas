import type { Database } from './database.js';

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
  run<T>(work: () => Promise<T>): Promise<T>;
}

/**
 * Hands the work to the database, which is the only thing that knows how its own
 * transactions are carried.
 *
 * This used to spell out `BEGIN`/`COMMIT`/`ROLLBACK` itself, which was right
 * while there was one database and one connection. A database serving many
 * callers at once has to keep every statement of one transaction on a single
 * connection, and which connection that is, is knowledge only its adapter has.
 */
export class DatabaseUnitOfWork implements UnitOfWork {
  constructor(private readonly db: Database) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }
}

/** A pass-through for unit tests, where the fakes have no transaction to join. */
export class DirectUnitOfWork implements UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T> {
    return work();
  }
}
