import { describe, expect, it } from 'vitest';
import { i18n } from '../../src/i18n';
import { refusalText } from '../../src/api/refusal-text';

/**
 * A refusal to publish, put into the host's language.
 *
 * The API writes one sentence, in English, for every reader it has — a
 * connected assistant, a log, an API client. A host reading the panel in
 * Spanish is not one of those readers: the sentence is interface text, written
 * by the system for them, and `internationalization` says interface text is
 * shown in the chosen language. What the sentence *names* — their people, the
 * things they are judged on — is theirs, and is carried through untouched.
 *
 * Tested here rather than through the two screens because both of them ask this
 * one function; a test per screen would measure the wiring twice and the words
 * not at all. The screens' own tests check they call it.
 */

/** The panel's two arguments for saying this: the words, and how to join a list in them. */
function reading(language: 'en' | 'es') {
  i18n.changeLanguage(language);
  return [i18n.t.bind(i18n), language] as const;
}

describe('a refusal in the host’s language', () => {
  it('says why a contest cannot go live, in Spanish', () => {
    const said = refusalText(
      { code: 'UNPARTNERED_IN_COUPLES', message: '"Elena" has no partner, and this contest is for couples.', details: { person: 'Elena' } },
      ...reading('es'),
    );

    expect(said).toContain('Elena');
    expect(said).not.toContain('has no partner');
    expect(said.toLowerCase()).toContain('pareja');
  });

  it('says the same thing in English', () => {
    const said = refusalText(
      { code: 'UNPARTNERED_IN_COUPLES', message: 'x', details: { person: 'Elena' } },
      ...reading('en'),
    );

    expect(said).toContain('Elena');
    expect(said).toContain('partner');
  });

  /*
   * The names are the host's own text. A translated "Taste" would be a bug, and
   * a refusal that dropped them would leave a host unable to tell which two of
   * their categories are the problem — which is the whole reason the domain
   * names them rather than the id they share.
   */
  it('names the two things it is about exactly as the host wrote them', () => {
    const said = refusalText(
      { code: 'DUPLICATE_CATEGORY_ID', message: 'x', details: { first: 'Taste', second: 'Originality' } },
      ...reading('es'),
    );

    expect(said).toContain('Taste');
    expect(said).toContain('Originality');
  });

  it('lists what a contest has still not said, in the reader’s own words', () => {
    const said = refusalText(
      { code: 'INCOMPLETE_DRAFT', message: 'x', details: { unsaid: ['format', 'scoring'] } },
      ...reading('es'),
    );

    // The same phrases the chat panel already uses for outstanding gaps, rather
    // than a second Spanish translation of the same three things.
    expect(said).toContain('qué tipo de concurso es');
    expect(said).toContain('cómo se puntúa');
    expect(said).not.toContain('quién participa');
  });

  it('reads a refusal that names nothing', () => {
    const said = refusalText({ code: 'NO_CATEGORIES', message: 'x' }, ...reading('es'));

    expect(said.trim()).not.toBe('');
    expect(said).not.toContain('NO_CATEGORIES');
  });

  /*
   * The guard this exists for. A refusal the domain grows later, before anybody
   * writes words for it, must not put a key or a code on screen — a host reading
   * "publishReason.SOMETHING_NEW" would read it as a fault in their contest. The
   * English sentence is worse than Spanish and far better than either.
   */
  it('falls back to the sentence it was given for a reason it has no words for', () => {
    const said = refusalText(
      { code: 'SOMETHING_ADDED_LATER', message: 'The contest disagrees with itself.' },
      ...reading('es'),
    );

    expect(said).toContain('The contest disagrees with itself.');
    expect(said).not.toContain('publishReason');
    expect(said).not.toContain('SOMETHING_ADDED_LATER');
  });

  /*
   * The words and the facts can fall out of step — a key interpolating
   * something the API does not send yet, or an older API answering a newer
   * panel. i18next renders the placeholder literally when that happens, and
   * "it doesn't say {{things}}." on screen is worse than the English sentence
   * the refusal arrived with. Found by an existing test rather than foreseen.
   */
  it('falls back to the sentence rather than showing an unfilled placeholder', () => {
    const said = refusalText(
      { code: 'INCOMPLETE_DRAFT', message: 'The draft is missing its scoring rules.' },
      ...reading('es'),
    );

    expect(said).toBe('The draft is missing its scoring rules.');
    expect(said).not.toContain('{{');
  });

  it('falls back to the sentence when there is no code at all', () => {
    const said = refusalText({ message: 'It could not be carried out.' }, ...reading('es'));

    expect(said).toBe('It could not be carried out.');
  });

  it('still says something when there is neither a code nor a sentence', () => {
    const said = refusalText({}, ...reading('es'));

    expect(said.trim()).not.toBe('');
    expect(said).not.toContain('publishReason');
  });
});
