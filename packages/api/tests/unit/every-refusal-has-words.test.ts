import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PublishErrorCode } from '@tapas/domain';
import { describe, expect, it } from 'vitest';

/**
 * Every way a publish can be refused has words in both languages.
 *
 * The panel falls back to the API's English sentence for a refusal it has no
 * words for, so a missing one is not a broken screen — it is a Spanish-speaking
 * host reading an English sentence, quietly, with nothing to announce it. That
 * is precisely the state this whole change existed to end, and it would creep
 * back one refusal at a time.
 *
 * The existing `translations-say-the-same-things` guard holds English and
 * Spanish to the same key set, so it catches a key added to one language only.
 * It cannot catch a refusal that nobody wrote a key for in either.
 *
 * It lives here rather than in `host-web` because this is where the union is:
 * `host-web` talks to the API and knows nothing of `@tapas/domain`, and giving
 * it that dependency to reach a type would cost more than this reach does.
 * `EVERY_CODE` is a `Record<PublishErrorCode, true>`, so a refusal added to the
 * domain fails to compile here until somebody lists it — and then fails this
 * test until somebody words it.
 */

const EVERY_CODE: Record<PublishErrorCode, true> = {
  INCOMPLETE_DRAFT: true,
  NO_PARTICIPANTS: true,
  NO_CATEGORIES: true,
  DUPLICATE_PERSON_ID: true,
  DUPLICATE_CATEGORY_ID: true,
  MISSING_PARTNER: true,
  INCONSISTENT_PARTNER: true,
  UNPARTNERED_IN_COUPLES: true,
  INVALID_RANGE: true,
  JUDGE_CANNOT_SCORE_ANY_DISH: true,
};

function publishReasons(language: 'en' | 'es'): Record<string, string> {
  const path = fileURLToPath(
    new URL(`../../../host-web/src/i18n/locales/${language}/review-draft.json`, import.meta.url),
  );
  return (JSON.parse(readFileSync(path, 'utf8')) as { publishReason?: Record<string, string> })
    .publishReason ?? {};
}

describe('every refusal to publish has words a host can read', () => {
  for (const language of ['en', 'es'] as const) {
    it(`words every refusal in ${language}`, () => {
      const worded = publishReasons(language);
      const missing = Object.keys(EVERY_CODE).filter((code) => !worded[code]?.trim());
      expect(missing).toEqual([]);
    });
  }

  it('words no refusal that cannot happen', () => {
    // A key left behind by a code that was removed reads as coverage and is not.
    for (const language of ['en', 'es'] as const) {
      const strays = Object.keys(publishReasons(language)).filter((code) => !(code in EVERY_CODE));
      expect(strays).toEqual([]);
    }
  });

  /*
   * A phrase is only translated if it says something different. Two languages
   * with the same string is how a copy-paste of the English column survives
   * review — and `DRAFT_NOT_FOUND` aside, none of these are proper nouns.
   */
  it('does not leave a Spanish refusal reading as its English one', () => {
    const en = publishReasons('en');
    const es = publishReasons('es');
    const untranslated = Object.keys(EVERY_CODE).filter((code) => en[code] === es[code]);
    expect(untranslated).toEqual([]);
  });
});
