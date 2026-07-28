import type { DishRepository, StoredDish } from '../../../src/index.js';

export class FakeDishRepository implements DishRepository {
  private readonly store = new Map<string, StoredDish>();
  private key(contestId: string, dishId: string): string {
    return `${contestId}:${dishId}`;
  }
  upsert(dish: StoredDish): void {
    this.store.set(this.key(dish.contestId, dish.dishId), dish);
  }
  findByContest(contestId: string): StoredDish[] {
    return [...this.store.values()].filter((dish) => dish.contestId === contestId);
  }
  find(contestId: string, dishId: string): StoredDish | undefined {
    return this.store.get(this.key(contestId, dishId));
  }
  deleteByContest(contestId: string): void {
    for (const [key, dish] of this.store) if (dish.contestId === contestId) this.store.delete(key);
  }
}
