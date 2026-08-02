import { describe, expect, it } from 'vitest';

/**
 * This app says the same things in English and in Spanish.
 *
 * i18next fails silently and invisibly when it does not: a key with no
 * counterpart is rendered as its own path, so "chat.contestCode" appears on
 * screen where the text should be. That reads as a rendering fault rather than a
 * missing translation, and nothing else in the suite notices — a screen with a
 * key path in it is a perfectly valid screen as far as every other test is
 * concerned.
 *
 * The locale files are read through Vite's own JSON loading rather than the
 * filesystem, so this stays an ordinary front-end test in a package that has no
 * business knowing about Node.
 */
const LOCALES = import.meta.glob<Record<string, unknown>>('../../src/i18n/locales/*/*.json', {
  eager: true,
  import: 'default',
});

/** Every leaf key, dotted — nested groups flattened, so a whole missing group is caught too. */
function leafKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, nested]) =>
    leafKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

/** `.../locales/en/chat.json` → `['en', 'chat.json']`. */
function localeAndNamespace(path: string): readonly [string, string] {
  const parts = path.split('/');
  return [parts[parts.length - 2]!, parts[parts.length - 1]!];
}

const byNamespace = new Map<string, Map<string, readonly string[]>>();
for (const [path, contents] of Object.entries(LOCALES)) {
  const [language, namespace] = localeAndNamespace(path);
  const languages = byNamespace.get(namespace) ?? new Map<string, readonly string[]>();
  languages.set(language, leafKeys(contents).sort());
  byNamespace.set(namespace, languages);
}

const namespaces = [...byNamespace.keys()].sort();

describe('the screens say the same things in English and Spanish', () => {
  it('has namespaces to compare', () => {
    expect(namespaces.length).toBeGreaterThan(0);
  });

  /*
   * One case per namespace rather than one lump, so a failure names the file to
   * open as well as the key to add.
   */
  it.each(namespaces)('%s', (namespace) => {
    const languages = byNamespace.get(namespace)!;
    const english = languages.get('en') ?? [];
    const spanish = languages.get('es') ?? [];

    expect({
      missingFromSpanish: english.filter((key) => !spanish.includes(key)),
      missingFromEnglish: spanish.filter((key) => !english.includes(key)),
    }).toEqual({ missingFromSpanish: [], missingFromEnglish: [] });
  });

  it('has every namespace in both languages', () => {
    for (const [namespace, languages] of byNamespace) {
      expect({ namespace, languages: [...languages.keys()].sort() }).toEqual({
        namespace,
        languages: ['en', 'es'],
      });
    }
  });
});
