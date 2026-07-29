import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, FormField } from '@tapas/ui';
import {
  ApiError,
  inviteHost,
  listHostAccounts,
  listInvitations,
  resendInvitation,
  revokeInvitation,
} from '../api/client';
import { mergePeople, type Person } from '../people/merge-people';
import styles from './people.module.css';

type Screen = { kind: 'loading' } | { kind: 'people'; people: Person[] } | { kind: 'notAllowed' };

/**
 * Who has access to this deployment, and the ways to change that.
 *
 * One list, keyed by address: an account beats any invitation to the same
 * address, and where there is no account the newest invitation stands for the
 * person. The join lives in `mergePeople`, tested on its own, because the rule
 * is easier to get subtly wrong than it looks.
 *
 * A host who reaches this screen is told so and left here. The previous slice
 * learned what redirecting on server state costs: it locked hosts out of a
 * screen they could have used. The refusal is recorded by the API, which is
 * right — a host reaching the administrative surface is what that record exists
 * for.
 */
export function People() {
  const { t } = useTranslation();
  const [screen, setScreen] = useState<Screen>({ kind: 'loading' });
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState<string | undefined>();
  const [linkToPassOn, setLinkToPassOn] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [accounts, invitations] = await Promise.all([listHostAccounts(), listInvitations()]);
      setScreen({ kind: 'people', people: mergePeople(accounts, invitations) });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 403) setScreen({ kind: 'notAllowed' });
      else setFormError(t('people.errorGeneric'));
    }
  }, [t]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onInvite(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    setLinkToPassOn(undefined);
    setSubmitting(true);
    try {
      const invited = await inviteHost(email);
      // Shown once. Nothing stores the link, so it can never appear in the list
      // afterwards and the screen must not look as though it could.
      if (!invited.messageSent) setLinkToPassOn(invited.link);
      setEmail('');
      await reload();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : undefined;
      if (code === 'EMAIL_TAKEN') setFormError(t('people.errorEmailTaken'));
      else if (code === 'INVALID_EMAIL') setFormError(t('people.errorInvalidEmail'));
      else setFormError(t('people.errorGeneric'));
    }
    setSubmitting(false);
  }

  async function act(action: 'revoke' | 'resend', invitationId: string) {
    setFormError(undefined);
    setLinkToPassOn(undefined);
    try {
      if (action === 'revoke') await revokeInvitation(invitationId);
      else {
        const resent = await resendInvitation(invitationId);
        if (!resent.messageSent) setLinkToPassOn(resent.link);
      }
      await reload();
    } catch {
      setFormError(t('people.errorGeneric'));
    }
  }

  if (screen.kind === 'notAllowed') {
    return (
      <main id="main" className={styles.page}>
        <h1>{t('people.notAllowedTitle')}</h1>
        <p>{t('people.notAllowedBody')}</p>
      </main>
    );
  }

  return (
    <main id="main" className={styles.page}>
      <h1>{t('people.title')}</h1>
      <p>{t('people.subtitle')}</p>

      <form className={styles.invite} onSubmit={onInvite} noValidate>
        {formError ? (
          <div className={styles.alert} role="alert">
            <span aria-hidden="true">✕</span>
            <span>{formError}</span>
          </div>
        ) : null}
        {linkToPassOn ? (
          <div className={styles.notice} role="status">
            <p>{t('people.notSentBody')}</p>
            <p>
              <code>{linkToPassOn}</code>
            </p>
          </div>
        ) : null}
        <FormField
          id="email"
          label={t('people.email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? t('people.inviting') : t('people.invite')}
        </Button>
      </form>

      {screen.kind === 'loading' ? (
        <p role="status">{t('common.loading')}</p>
      ) : (
        <table className={styles.table}>
          <caption className={styles.caption}>{t('people.tableCaption')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('people.columnPerson')}</th>
              <th scope="col">{t('people.columnStanding')}</th>
              <th scope="col">{t('people.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {screen.people.map((person) => (
              <tr key={person.email}>
                <td>{person.email}</td>
                <td>{t(`people.standing.${person.standing}`)}</td>
                <td>
                  {person.invitationId ? (
                    <>
                      <Button
                        type="button"
                        onClick={() => void act('revoke', person.invitationId!)}
                      >
                        {t('people.revoke')}
                      </Button>{' '}
                      <Button
                        type="button"
                        onClick={() => void act('resend', person.invitationId!)}
                      >
                        {t('people.resend')}
                      </Button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
