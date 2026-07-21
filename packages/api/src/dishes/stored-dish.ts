/** A dish a cook has submitted — presentation attached to a materialized dish slot. */
export interface StoredDish {
  readonly contestId: string;
  readonly dishId: string;
  readonly name: string;
  readonly description: string | null;
  readonly submitterIds: readonly string[];
  readonly submittedAt: string;
}
