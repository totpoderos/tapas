import { FIELD_NAMES, type FieldName } from './case.js';

/**
 * Keywords that indicate a clarification is asking about a given field.
 *
 * **This is the one deliberately fuzzy part of the harness.** Clarifications
 * are free-form natural language written by the model, so deciding "did it ask
 * about participants?" cannot be exact. Keeping the approximation here — one
 * small module with its own tests, fed by real clarification strings captured
 * from live model runs — means the fuzziness is visible and measurable rather
 * than buried inside the runner.
 *
 * Known failure mode: a clarification that asks about a field in wording none
 * of these keywords cover reads as "not asked", depressing missing-field
 * recall. That direction is deliberate — under-crediting the model is the safe
 * bias for a metric whose job is to catch regressions.
 */
const FIELD_KEYWORDS: Record<FieldName, readonly string[]> = {
  name: ['name', 'called', 'title'],
  attribution: ['attribution', 'credit', 'per person', 'per couple', 'individually', 'as a couple'],
  antiBias: ['anti-bias', 'antibias', 'bias', 'pair', 'couple', 'partner'],
  scoring: ['scor', 'score', 'rating', 'rate', 'categor', 'criteria', 'range', 'points'],
  // Stems, not whole words — and the stem has to be the *common* prefix:
  // "participants" and "participate" diverge at the 10th letter, so
  // "participa" is the longest stem that catches both.
  participants: [
    'participa',
    'who is',
    "who's",
    'who can',
    'cook',
    'contestant',
    'competitor',
    'people',
  ],
  closeRule: ['clos', 'end', 'finish', 'deadline', 'when voting', 'stop'],
  revealStrategy: ['reveal', 'announce', 'results', 'winner', 'publish'],
};

/** Whether any clarification appears to be asking about this field. */
export function asksAbout(clarifications: readonly string[], field: FieldName): boolean {
  const haystack = clarifications.join(' \n ').toLowerCase();
  return FIELD_KEYWORDS[field].some((keyword) => haystack.includes(keyword));
}

/** Every field the clarifications appear to be asking about. */
export function fieldsAskedAbout(clarifications: readonly string[]): FieldName[] {
  return FIELD_NAMES.filter((field) => asksAbout(clarifications, field));
}
