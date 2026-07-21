import type { DishId, TallyResult } from '@tapas/domain';

export interface ResultsDto {
  readonly categories: ReadonlyArray<{
    readonly categoryId: string;
    readonly totals: Record<DishId, number>;
    readonly winners: readonly DishId[];
  }>;
  readonly overallTotals: Record<DishId, number>;
  readonly overallWinners: readonly DishId[];
}

/** `TallyResult` carries `Map`s, which `JSON.stringify` silently empties — flatten them for an HTTP response. */
export function toResultsDto(results: TallyResult): ResultsDto {
  return {
    categories: results.categories.map((category) => ({
      categoryId: category.categoryId,
      totals: Object.fromEntries(category.totals),
      winners: category.winners,
    })),
    overallTotals: Object.fromEntries(results.overallTotals),
    overallWinners: results.overallWinners,
  };
}
