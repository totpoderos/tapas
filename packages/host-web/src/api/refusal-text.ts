import type { TFunction } from 'i18next';

/**
 * A refusal, as it arrives: the sentence the API wrote, and — when it
 * classified one — the code and the facts behind it.
 */
export interface Refusal {
  readonly code?: string;
  readonly message?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Why something could not be done, in the language the host is reading.
 *
 * The API writes one sentence, in English, for every reader it has — a
 * connected assistant, a log, an API client. A host reading this panel is not
 * one of those: the sentence is interface text, written by the system for them,
 * and `internationalization` says interface text is shown in the chosen
 * language. So the code chooses the words and the facts fill them in.
 *
 * What the sentence *names* is not translated. "Taste", "Elena" — those are the
 * host's own text, carried through exactly as they wrote them, which is also
 * what makes the refusal actionable: a host has to know which two categories,
 * which person.
 *
 * A reason with no words of its own falls back to the sentence it was given.
 * Not to nothing, and never to a key: a host who reads
 * "publishReason.SOMETHING_NEW" reads it as a fault in their contest. The
 * chat panel drops an outstanding gap it cannot word, because the sentence
 * around it still reads; a refusal is the opposite — dropping it would leave a
 * host told only that something failed. English is worse than Spanish here and
 * much better than either, and it is exactly what they saw before this existed.
 *
 * NOTE: only publish refusals carry a code and details today. Every other
 * refusal the panel shows — sign-in, enrollment, scoring — takes the fallback
 * and stays in English. That is the gap this mechanism was built to close next,
 * not a defect in this function.
 */
export function refusalText(refusal: Refusal, t: TFunction, language: string): string {
  const sentence = refusal.message?.trim();
  const key = refusal.code ? `reviewDraft.publishReason.${refusal.code}` : undefined;
  if (!key) return sentence || t('reviewDraft.publishErrorGeneric');

  const said = t(key, { ...interpolations(refusal.details, t, language), defaultValue: '' });

  /*
   * Worded, and every fact it needed was there. A refusal whose facts are
   * missing leaves i18next rendering its placeholder literally — "it doesn't say
   * {{things}}." — which is worse on screen than the English sentence it came
   * with. It happens whenever the words and the facts fall out of step: a key
   * that interpolates something the API does not send yet, or an older API
   * answering a newer panel.
   */
  if (said && !said.includes('{{')) return said;

  return sentence || t('reviewDraft.publishErrorGeneric');
}

/**
 * The facts, ready to be interpolated.
 *
 * `unsaid` is the one that needs work: it arrives as the gaps themselves —
 * `['format', 'scoring']` — because a reader with its own words has its own way
 * of listing things. The phrases are the ones the chat panel already uses for
 * outstanding gaps, rather than a second translation of the same three things,
 * and they are joined with "or" because any one of them alone stops a publish.
 */
function interpolations(
  details: Readonly<Record<string, unknown>> | undefined,
  t: TFunction,
  language: string,
): Record<string, unknown> {
  if (!details) return {};
  const { unsaid, ...rest } = details;
  if (!Array.isArray(unsaid)) return rest;

  const said = unsaid
    .map((gap) => t(`chat.needs.${String(gap)}`, { defaultValue: '' }))
    .filter((phrase) => phrase !== '');
  return {
    ...rest,
    things: new Intl.ListFormat(language, { type: 'disjunction' }).format(said),
  };
}
