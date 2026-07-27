import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, FormField } from '@tapas/ui';
import {
  ApiError,
  claimPlace,
  getMe,
  getPlaces,
  type Identity,
  type Place,
} from '../api/client';
import { YourDish } from './your-dish';

const REMEMBERED_CONTEST = 'tapas.contestId';

type Step =
  | { readonly name: 'recognizing' }
  | { readonly name: 'code' }
  | { readonly name: 'choosing'; readonly contestId: string; readonly places: readonly Place[] }
  | { readonly name: 'joined'; readonly identity: Identity };

/**
 * Joining a contest: enter the code (or arrive by a `/j/:code` link), choose your
 * own name from the places still open, and you're in — no account, no password.
 * Once claimed, the contest is remembered on this device so a reopen skips
 * straight back in. Only open places are ever shown; a place taken in the moment
 * between loading and choosing is refused, and the list refreshes.
 */
export function Join() {
  const { t } = useTranslation();
  const { code: codeParam } = useParams();
  const [step, setStep] = useState<Step>({ name: 'recognizing' });
  const [code, setCode] = useState(codeParam ?? '');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const lookUpPlaces = useCallback(async (joinCode: string) => {
    setError(undefined);
    setBusy(true);
    try {
      const open = await getPlaces(joinCode);
      setStep({ name: 'choosing', contestId: open.contestId, places: open.places });
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? t('join.errorUnknownCode')
          : t('join.errorGeneric'),
      );
      setStep({ name: 'code' });
    } finally {
      setBusy(false);
    }
  }, []);

  // On open, recognise a returning participant from what this device remembers;
  // otherwise start at the code entry, or jump to the places for a deep link.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const rememberedContest = localStorage.getItem(REMEMBERED_CONTEST);
    (async () => {
      if (rememberedContest) {
        const identity = await getMe(rememberedContest).catch(() => null);
        if (identity) {
          setStep({ name: 'joined', identity });
          return;
        }
      }
      if (codeParam) {
        await lookUpPlaces(codeParam);
        return;
      }
      setStep({ name: 'code' });
    })();
  }, [codeParam, lookUpPlaces]);

  async function onSubmitCode(event: FormEvent) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed || busy) return;
    await lookUpPlaces(trimmed);
  }

  async function onChoose(place: Place) {
    if (step.name !== 'choosing' || busy) return;
    setError(undefined);
    setBusy(true);
    try {
      const identity = await claimPlace(code.trim(), place.participantId);
      localStorage.setItem(REMEMBERED_CONTEST, identity.contestId);
      setStep({ name: 'joined', identity });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        await lookUpPlaces(code.trim()); // refresh first — the taken place drops off
        setError(t('join.errorPlaceTaken')); // then announce
      } else {
        setError(t('join.errorJoining'));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main" className="pt-main">
      <div className="pt-brand">
        <span className="dot" aria-hidden="true" />
        <b>{t('common.brand')}</b>
      </div>

      {error ? (
        <div className="pt-alert" role="alert">
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </div>
      ) : null}

      {step.name === 'recognizing' && (
        <p role="status" className="pt-note">
          {t('common.loading')}
        </p>
      )}

      {step.name === 'code' && (
        <>
          <h1 className="pt-title">{t('join.codeTitle')}</h1>
          <p className="pt-lead">{t('join.codeLead')}</p>
          <form className="pt-form" onSubmit={onSubmitCode} noValidate>
            <FormField
              id="join-code"
              label={t('join.codeLabel')}
              className="pt-code"
              autoCapitalize="characters"
              autoComplete="off"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button type="submit" block disabled={busy || !code.trim()}>
              {busy ? t('join.checking') : t('join.continue')}
            </Button>
          </form>
        </>
      )}

      {step.name === 'choosing' && (
        <>
          <h1 className="pt-title">{t('join.chooseTitle')}</h1>
          <p className="pt-lead">{t('join.chooseLead')}</p>
          {step.places.length === 0 ? (
            <p className="pt-note">{t('join.allTaken')}</p>
          ) : (
            <ul className="pt-places" aria-label={t('join.openPlaces')}>
              {step.places.map((place) => (
                <li key={place.participantId}>
                  <button
                    type="button"
                    className="pt-place"
                    disabled={busy}
                    onClick={() => void onChoose(place)}
                  >
                    {place.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {step.name === 'joined' && <YourDish identity={step.identity} />}
    </main>
  );
}
