import type { CategoryId, DishId, MaterializedContest } from '../model.js';

export interface TallyEntry {
  readonly dishId: DishId;
  readonly categoryId: CategoryId;
  readonly value: number;
}

export interface CategoryTally {
  readonly categoryId: CategoryId;
  readonly totals: ReadonlyMap<DishId, number>;
  /** Every dish tied for the highest total in this category — more than one means a tie. */
  readonly winners: readonly DishId[];
}

export interface TallyResult {
  readonly categories: readonly CategoryTally[];
  readonly overallTotals: ReadonlyMap<DishId, number>;
  /** Every dish tied for the highest total across all categories — more than one means a tie. */
  readonly overallWinners: readonly DishId[];
}

function winnersOf(totals: ReadonlyMap<DishId, number>): DishId[] {
  const highest = Math.max(...totals.values());
  return [...totals.entries()].filter(([, total]) => total === highest).map(([dishId]) => dishId);
}

/**
 * Tallies sent votes into a winner per category and an overall winner —
 * higher is always better, and a dish's score is the sum of every judge's
 * score for it (design confirmed: uniform "higher wins" across both fixed
 * and ranking ranges; sum, not average, since every dish open to a judge is
 * scored by that judge). A tie surfaces as multiple joint winners; resolving
 * it is a host action, not this function's concern. A pure function: no I/O.
 */
export function tally(materialized: MaterializedContest, entries: readonly TallyEntry[]): TallyResult {
  const categories = materialized.categories.map((category): CategoryTally => {
    const totals = new Map(materialized.dishes.map((dish) => [dish.id, 0]));
    for (const entry of entries) {
      if (entry.categoryId !== category.id) continue;
      totals.set(entry.dishId, (totals.get(entry.dishId) ?? 0) + entry.value);
    }
    return { categoryId: category.id, totals, winners: winnersOf(totals) };
  });

  const overallTotals = new Map(materialized.dishes.map((dish) => [dish.id, 0]));
  for (const category of categories) {
    for (const [dishId, total] of category.totals) {
      overallTotals.set(dishId, (overallTotals.get(dishId) ?? 0) + total);
    }
  }

  return { categories, overallTotals, overallWinners: winnersOf(overallTotals) };
}
