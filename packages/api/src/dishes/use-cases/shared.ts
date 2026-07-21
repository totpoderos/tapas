import type { StoredDish } from '../stored-dish.js';

export type SubmitDishErrorCode = 'NAME_REQUIRED' | 'NO_DISH_FOR_PARTICIPANT' | 'CONTEST_CLOSED';

export interface SubmitDishError {
  readonly code: SubmitDishErrorCode;
  readonly message: string;
}

export type SubmitDishResult =
  | { readonly ok: true; readonly dish: StoredDish }
  | { readonly ok: false; readonly error: SubmitDishError };
