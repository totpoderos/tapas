/** What a statement's parameters may be. Matches what the schema stores: text, numbers, and absence. */
export type SqlValue = string | number | null;

/** What running a statement reports back. Only `changes` is read anywhere, so only `changes` is promised. */
export interface StatementResult {
  readonly changes: number;
}

/**
 * One statement, ready to run.
 *
 * Three methods because three are used: `run` for a write, `get` for one row,
 * `all` for many. Rows come back untyped — every repository already casts to its
 * own row shape at the call site, and a port that pretended to know the shape
 * would be claiming something it cannot check.
 */
export interface PreparedStatement {
  run(...params: readonly SqlValue[]): Promise<StatementResult>;
  get(...params: readonly SqlValue[]): Promise<unknown>;
  all(...params: readonly SqlValue[]): Promise<unknown[]>;
}

/**
 * The one thing that speaks to a database.
 *
 * Everything above this line — 13 repositories, one set of SQL — is written once
 * and never learns which database is underneath. Everything a database differs
 * about lives below it, in an adapter: how a placeholder is spelled, whether
 * there is a pool, what has to be said when a connection opens.
 *
 * The surface is deliberately the *whole* of what the repositories were already
 * doing and not one method more — 17 `prepare` sites, 9 `exec` sites and the
 * transaction. A repository that cannot say what it means through these three is
 * a signal that the concern has drifted out of the data layer, not a reason to
 * widen the port.
 *
 * Asynchronous even where the implementation is not. SQLite answers immediately
 * and could have kept a synchronous shape, but then the shape of every caller
 * would depend on which database it was talking to, which is the one thing this
 * port exists to prevent.
 */
export interface Database {
  prepare(sql: string): PreparedStatement;
  exec(sql: string): Promise<void>;

  /**
   * Runs a piece of work as one all-or-nothing transaction.
   *
   * Takes the work rather than handing out `begin` and `commit` because a
   * database that serves many callers at once has to carry every statement of
   * one transaction on a single connection. A caller holding begin/commit could
   * not be made to do that; a caller handing over its work can.
   */
  transaction<T>(work: () => Promise<T>): Promise<T>;

  close(): Promise<void>;
}
