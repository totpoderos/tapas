import type { MaterializedContest } from '@tapas/domain';

interface SerializedMaterialized {
  dishes: Array<{ id: string; submitterIds: string[] }>;
  allowedVoters: Record<string, string[]>;
  scoreRangeByVoter: Record<string, { min: number; max: number }>;
  uniquePerCategory: boolean;
  categories: Array<{ id: string; name: string }>;
}

/** Serialize the materialized view (Maps/Sets → JSON) for storage. */
export function serializeMaterialized(materialized: MaterializedContest): string {
  const allowedVoters: Record<string, string[]> = {};
  for (const [dishId, voters] of materialized.allowedVoters) allowedVoters[dishId] = [...voters];

  const scoreRangeByVoter: Record<string, { min: number; max: number }> = {};
  for (const [voterId, bounds] of materialized.scoreRangeByVoter) {
    scoreRangeByVoter[voterId] = { min: bounds.min, max: bounds.max };
  }

  const payload: SerializedMaterialized = {
    dishes: materialized.dishes.map((dish) => ({ id: dish.id, submitterIds: [...dish.submitterIds] })),
    allowedVoters,
    scoreRangeByVoter,
    uniquePerCategory: materialized.uniquePerCategory,
    categories: materialized.categories.map((category) => ({ id: category.id, name: category.name })),
  };
  return JSON.stringify(payload);
}

/** Rebuild the materialized view (JSON → Maps/Sets). */
export function deserializeMaterialized(json: string): MaterializedContest {
  const payload = JSON.parse(json) as SerializedMaterialized;
  return {
    dishes: payload.dishes,
    allowedVoters: new Map(Object.entries(payload.allowedVoters).map(([dishId, voters]) => [dishId, new Set(voters)])),
    scoreRangeByVoter: new Map(Object.entries(payload.scoreRangeByVoter)),
    uniquePerCategory: payload.uniquePerCategory,
    categories: payload.categories,
  };
}
