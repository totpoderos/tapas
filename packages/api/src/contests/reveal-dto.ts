import type { Category, DishId, TallyResult } from '@tapas/domain';

/** A dish's standing in a category (or overall): its name and total, for the leaderboard. */
export interface RevealStanding {
  readonly dishId: string;
  readonly name: string;
  readonly total: number;
}

export interface RevealWinner {
  readonly dishId: string;
  readonly name: string;
}

export interface RevealCategory {
  readonly categoryId: string;
  readonly name: string;
  readonly winners: readonly RevealWinner[];
  readonly standings: readonly RevealStanding[];
}

/** The participant-facing reveal: winners and leaderboards, by dish name (design.md §11C). */
export interface RevealDto {
  readonly contestName: string;
  readonly overall: { readonly winners: readonly RevealWinner[]; readonly standings: readonly RevealStanding[] };
  readonly categories: readonly RevealCategory[];
}

/**
 * Builds the participant reveal view from a `TallyResult`, attaching dish and
 * category names and turning each total map into a leaderboard (highest first).
 * Ties surface as they are — more than one winner — never resolved here.
 */
export function toRevealDto(
  contestName: string,
  categories: readonly Category[],
  results: TallyResult,
  dishName: (dishId: DishId) => string,
): RevealDto {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const winner = (dishId: DishId): RevealWinner => ({ dishId, name: dishName(dishId) });
  const standingsOf = (totals: ReadonlyMap<DishId, number>): RevealStanding[] =>
    [...totals.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([dishId, total]) => ({ dishId, name: dishName(dishId), total }));

  return {
    contestName,
    overall: {
      winners: results.overallWinners.map(winner),
      standings: standingsOf(results.overallTotals),
    },
    categories: results.categories.map((category) => ({
      categoryId: category.categoryId,
      name: categoryName.get(category.categoryId) ?? category.categoryId,
      winners: category.winners.map(winner),
      standings: standingsOf(category.totals),
    })),
  };
}
