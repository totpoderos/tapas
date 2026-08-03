import type { DishRepository, StoredDish } from '../../../src/index.js';

export class FakeDishRepository implements DishRepository {
  private readonly store = new Map<string, StoredDish>();
  private key(contestId: string, dishId: string): string {
    return `${contestId}:${dishId}`;
  }
  async upsert(dish: StoredDish): Promise<void> {
    this.store.set(this.key(dish.contestId, dish.dishId), dish);
  }
  async findByContest(contestId: string): Promise<StoredDish[]> {
    return [...this.store.values()].filter((dish) => dish.contestId === contestId);
  }
  async find(contestId: string, dishId: string): Promise<StoredDish | undefined> {
    return this.store.get(this.key(contestId, dishId));
  }
  async deleteByContest(contestId: string): Promise<void> {
    for (const [key, dish] of this.store) if (dish.contestId === contestId) this.store.delete(key);
  }
}
