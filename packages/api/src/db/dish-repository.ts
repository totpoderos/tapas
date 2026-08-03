import type { Database } from './database.js';
import type { StoredDish } from '../dishes/stored-dish.js';

export interface DishRepository {
  /** Inserts or updates a dish by (contestId, dishId) — a cook may revise their dish. */
  upsert(dish: StoredDish): Promise<void>;
  findByContest(contestId: string): Promise<StoredDish[]>;
  find(contestId: string, dishId: string): Promise<StoredDish | undefined>;
  /** Removes every dish entered in a contest. */
  deleteByContest(contestId: string): Promise<void>;
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
  constructor(private readonly db: Database) {}

  async upsert(dish: StoredDish): Promise<void> {
    await this.db
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

  async findByContest(contestId: string): Promise<StoredDish[]> {
    const rows = await this.db
      .prepare(`SELECT * FROM dishes WHERE contest_id = ? ORDER BY dish_id`)
      .all(contestId) as unknown as DishRow[];
    return rows.map(toDish);
  }

  async find(contestId: string, dishId: string): Promise<StoredDish | undefined> {
    const row = await this.db
      .prepare(`SELECT * FROM dishes WHERE contest_id = ? AND dish_id = ?`)
      .get(contestId, dishId) as unknown as DishRow | undefined;
    return row ? toDish(row) : undefined;
  }

  async deleteByContest(contestId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM dishes WHERE contest_id = ?`).run(contestId);
  }
}
