import { createI18n } from '@tapas/ui';

// One namespace ("translation"), nested by screen. Each screen's strings live in
// their own JSON file per language, so a screen's text is edited in one place and
// a whole new language is just another folder of these files (internationalization
// spec: "Adding a language does not change the screens").
import enCommon from './locales/en/common.json';
import enShell from './locales/en/shell.json';
import enSignIn from './locales/en/sign-in.json';
import enAcceptInvite from './locales/en/accept-invite.json';
import enClaim from './locales/en/claim.json';
import enPeople from './locales/en/people.json';
import enHome from './locales/en/home.json';
import enNewContest from './locales/en/new-contest.json';
import enReviewDraft from './locales/en/review-draft.json';
import enChat from './locales/en/chat.json';
import enAuditLog from './locales/en/audit-log.json';
import enContestControl from './locales/en/contest-control.json';
import enReveal from './locales/en/reveal.json';
import enResults from './locales/en/results.json';
import enDeleteContest from './locales/en/delete-contest.json';

import esCommon from './locales/es/common.json';
import esShell from './locales/es/shell.json';
import esSignIn from './locales/es/sign-in.json';
import esAcceptInvite from './locales/es/accept-invite.json';
import esClaim from './locales/es/claim.json';
import esPeople from './locales/es/people.json';
import esHome from './locales/es/home.json';
import esNewContest from './locales/es/new-contest.json';
import esReviewDraft from './locales/es/review-draft.json';
import esChat from './locales/es/chat.json';
import esAuditLog from './locales/es/audit-log.json';
import esContestControl from './locales/es/contest-control.json';
import esReveal from './locales/es/reveal.json';
import esResults from './locales/es/results.json';
import esDeleteContest from './locales/es/delete-contest.json';

const en = {
  common: enCommon,
  // The panel's own navigation and header, shared by every host surface.
  shell: enShell,
  signIn: enSignIn,
  acceptInvite: enAcceptInvite,
  claim: enClaim,
  people: enPeople,
  home: enHome,
  newContest: enNewContest,
  reviewDraft: enReviewDraft,
  chat: enChat,
  auditLog: enAuditLog,
  contestControl: enContestControl,
  // Read by the shared RevealView in @tapas/ui, which resolves `reveal.*` against
  // whichever app renders it — a missing key here would be announced aloud.
  reveal: enReveal,
  results: enResults,
  deleteContest: enDeleteContest,
};

const es = {
  common: esCommon,
  shell: esShell,
  signIn: esSignIn,
  acceptInvite: esAcceptInvite,
  claim: esClaim,
  people: esPeople,
  home: esHome,
  newContest: esNewContest,
  reviewDraft: esReviewDraft,
  chat: esChat,
  auditLog: esAuditLog,
  contestControl: esContestControl,
  reveal: esReveal,
  results: esResults,
  deleteContest: esDeleteContest,
};

export const i18n = createI18n({
  en: { translation: en },
  es: { translation: es },
});
