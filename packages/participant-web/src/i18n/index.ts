import { createI18n } from '@tapas/ui';

// One namespace ("translation"), nested by screen — the same shape the host app
// uses, so both apps read the same way and a new language is just another folder
// of these files (internationalization spec: "Adding a language does not change
// the screens").
import enCommon from './locales/en/common.json';
import enJoin from './locales/en/join.json';
import enYourDish from './locales/en/your-dish.json';
import enScore from './locales/en/score.json';
import enReveal from './locales/en/reveal.json';

import esCommon from './locales/es/common.json';
import esJoin from './locales/es/join.json';
import esYourDish from './locales/es/your-dish.json';
import esScore from './locales/es/score.json';
import esReveal from './locales/es/reveal.json';

const en = {
  common: enCommon,
  join: enJoin,
  yourDish: enYourDish,
  score: enScore,
  reveal: enReveal,
};

const es = {
  common: esCommon,
  join: esJoin,
  yourDish: esYourDish,
  score: esScore,
  reveal: esReveal,
};

export const i18n = createI18n({
  en: { translation: en },
  es: { translation: es },
});
