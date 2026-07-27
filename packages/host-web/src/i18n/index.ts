import { createI18n } from '@tapas/ui';

// One namespace ("translation"), nested by screen. Each screen's strings live in
// their own JSON file per language, so a screen's text is edited in one place and
// a whole new language is just another folder of these files (internationalization
// spec: "Adding a language does not change the screens").
import enCommon from './locales/en/common.json';
import enSignIn from './locales/en/sign-in.json';
import enSignUp from './locales/en/sign-up.json';
import enHome from './locales/en/home.json';
import enNewContest from './locales/en/new-contest.json';
import enReviewDraft from './locales/en/review-draft.json';
import enChat from './locales/en/chat.json';
import enAuditLog from './locales/en/audit-log.json';
import enContestControl from './locales/en/contest-control.json';

import esCommon from './locales/es/common.json';
import esSignIn from './locales/es/sign-in.json';
import esSignUp from './locales/es/sign-up.json';
import esHome from './locales/es/home.json';
import esNewContest from './locales/es/new-contest.json';
import esReviewDraft from './locales/es/review-draft.json';
import esChat from './locales/es/chat.json';
import esAuditLog from './locales/es/audit-log.json';
import esContestControl from './locales/es/contest-control.json';

const en = {
  common: enCommon,
  signIn: enSignIn,
  signUp: enSignUp,
  home: enHome,
  newContest: enNewContest,
  reviewDraft: enReviewDraft,
  chat: enChat,
  auditLog: enAuditLog,
  contestControl: enContestControl,
};

const es = {
  common: esCommon,
  signIn: esSignIn,
  signUp: esSignUp,
  home: esHome,
  newContest: esNewContest,
  reviewDraft: esReviewDraft,
  chat: esChat,
  auditLog: esAuditLog,
  contestControl: esContestControl,
};

export const i18n = createI18n({
  en: { translation: en },
  es: { translation: es },
});
