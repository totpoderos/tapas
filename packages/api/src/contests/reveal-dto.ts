import type { Category, DishId, MaterializedContest, TallyResult } from '@tapas/domain';

/** A dish's standing in a category (or overall): its name and total, for the leaderboard. */
export interface RevealStanding {
  readonly dishId: string;
  readonly name: string;
  readonly total: number;
}

export interface RevealWinner {
  readonly dishId: string;
  /** The dish, by the name it was submitted under. */
  readonly name: string;
  /**
   * Who brought it — so the result names a person as well as a plate.
   *
   * A LIST, because a dish can genuinely have more than one cook: under the
   * `couples` format partners share a dish, and a singular field would
   * force this to pick one of two people who cooked together. It never replaces
   * `name`; a dish is identified to both audiences by what it was called.
   */
  readonly cooks: readonly string[];
}

/**
 * What a dish nobody named is called: whose it is.
 *
 * The em-dash is the last resort and the only one left — a dish with no
 * submitted name AND no cook on the roster has genuinely nothing to be called,
 * and a dash carries no language to get wrong. Unreachable with consistent data.
 */
const whoseItIs = (cooks: readonly string[]): string => (cooks.length > 0 ? cooks.join(' & ') : '—');

/** What a dish is called and who brought it. */
export interface DishNaming {
  readonly nameOf: (dishId: DishId) => string;
  readonly cooksOf: (dishId: DishId) => readonly string[];
}

/**
 * Builds the naming both reveal routes need, in one place.
 *
 * The host's `/winners` and the participant's `/reveal` each call `toRevealDto`
 * with their own arguments, which is precisely the shape of this repo's
 * recurring defect: two paths assumed equivalent, agreeing by convention until
 * one is edited. They now build their naming from the same function, so a dish
 * cannot be called one thing on one screen and another elsewhere.
 *
 * Cooks come from the MATERIALIZED dish rather than from the submitted one: the
 * roster slot exists whether or not anyone got round to submitting a dish, so a
 * dish that was never named still knows whose it was.
 */
export function dishNaming(
  materialized: MaterializedContest,
  dishes: readonly { readonly dishId: string; readonly name: string }[],
  roster: readonly { readonly participantId: string; readonly displayName: string }[],
): DishNaming {
  const names = new Map(dishes.map((dish) => [dish.dishId, dish.name]));
  const people = new Map(roster.map((place) => [place.participantId, place.displayName]));
  const cooks = new Map(
    materialized.dishes.map((dish) => [
      dish.id,
      dish.submitterIds.map((id) => people.get(id)).filter((name): name is string => !!name),
    ]),
  );
  return {
    /*
     * A dish nobody named is called by the cook whose it is.
     *
     * It used to be called `A dish`, which is English written into the API and
     * therefore English on a Spanish participant's reveal, sitting between
     * dishes that are in Spanish. A person's name cannot go wrong that way:
     * `internationalization` already requires that what people typed is never
     * translated, so a name reads the same to every reader. Any phrase — "Sin
     * nombre", "Marta's dish" — would need wording in each language and would
     * be the same defect one layer down.
     *
     * Joined the way `RevealView` already joins cooks for its "brought by"
     * line, rather than inventing a second convention for the same list.
     */
    nameOf: (dishId) => names.get(dishId) ?? whoseItIs(cooks.get(dishId) ?? []),
    cooksOf: (dishId) => cooks.get(dishId) ?? [],
  };
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
  naming: DishNaming,
): RevealDto {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const winner = (dishId: DishId): RevealWinner => ({
    dishId,
    name: naming.nameOf(dishId),
    cooks: naming.cooksOf(dishId),
  });
  /*
   * The leaderboard stays dish names alone. Naming a cook is the headline's
   * job — a board that named everybody would turn the standings into a list of
   * who lost, which is not what a leaderboard is for.
   */
  const standingsOf = (totals: ReadonlyMap<DishId, number>): RevealStanding[] =>
    [...totals.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([dishId, total]) => ({ dishId, name: naming.nameOf(dishId), total }));

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
