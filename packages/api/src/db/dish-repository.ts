import type { DatabaseSync } from 'node:sqlite';
import type { StoredDish } from '../dishes/stored-dish.js';

export interface DishRepository {
  /** Inserts or updates a dish by (contestId, dishId) — a cook may revise their dish. */
  upsert(dish: StoredDish): void;
  findByContest(contestId: string): StoredDish[];
  find(contestId: string, dishId: string): StoredDish | undefined;
}

interface DishRow {
  contest_id: string;
  dish_id: string;
  display_name: string;
  description: string | null;
  submitter_ids: string;
  submitted_at: string;
}

function toDish(row: DishRow): StoredDish {
  return {
    contestId: row.contest_id,
    dishId: row.dish_id,
    name: row.display_name,
    description: row.description,
    submitterIds: JSON.parse(row.submitter_ids) as string[],
    submittedAt: row.submitted_at,
  };
}

export class SqliteDishRepository implements DishRepository {
  constructor(private readonly db: DatabaseSync) {}

  upsert(dish: StoredDish): void {
    this.db
      .prepare(
        `INSERT INTO dishes (contest_id, dish_id, display_name, description, submitter_ids, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (contest_id, dish_id) DO UPDATE SET
           display_name = excluded.display_name,
           description  = excluded.description,
           submitted_at = excluded.submitted_at`,
      )
      .run(
        dish.contestId,
        dish.dishId,
        dish.name,
        dish.description,
        JSON.stringify(dish.submitterIds),
        dish.submittedAt,
      );
  }

  findByContest(contestId: string): StoredDish[] {
    const rows = this.db
      .prepare(`SELECT * FROM dishes WHERE contest_id = ? ORDER BY dish_id`)
      .all(contestId) as unknown as DishRow[];
    return rows.map(toDish);
  }

  find(contestId: string, dishId: string): StoredDish | undefined {
    const row = this.db
      .prepare(`SELECT * FROM dishes WHERE contest_id = ? AND dish_id = ?`)
      .get(contestId, dishId) as unknown as DishRow | undefined;
    return row ? toDish(row) : undefined;
  }
}
