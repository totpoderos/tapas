export type { DomainEvent } from './events/domain-event.js';
export { SYSTEM_ACTOR } from './events/domain-event.js';

export type {
  Attribution,
  AntiBias,
  Category,
  CategoryId,
  ContestDraft,
  DishId,
  MaterializedContest,
  MaterializedDish,
  Person,
  PersonId,
  ScoreBounds,
  ScoreRange,
  ScoringConfig,
} from './model.js';

export { compile } from './compile.js';
export type { CompileError, CompileErrorCode, CompileResult } from './compile.js';
