import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight, WarningCircle } from '@phosphor-icons/react/dist/ssr';
import { Button, FormField } from '@tapas/ui';
import { Nav } from '../nav';
import styles from './join.module.css';
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

/*
 * Codes are uppercase, and the field draws them uppercase — so a code typed in
 * lowercase LOOKS accepted and is then refused. Fold the case here, where the
 * code enters the screen (keystrokes and `/j/:code` links alike), so what is
 * held matches what is shown.
 */
const normalise = (raw: string) => raw.trim().toUpperCase();

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
  const [code, setCode] = useState(normalise(codeParam ?? ''));
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
        await lookUpPlaces(normalise(codeParam));
        return;
      }
      setStep({ name: 'code' });
    })();
  }, [codeParam, lookUpPlaces]);

  async function onSubmitCode(event: FormEvent) {
    event.preventDefault();
    if (!code || busy) return;
    await lookUpPlaces(code);
  }

  async function onChoose(place: Place) {
    if (step.name !== 'choosing' || busy) return;
    setError(undefined);
    setBusy(true);
    try {
      const identity = await claimPlace(code, place.participantId);
      localStorage.setItem(REMEMBERED_CONTEST, identity.contestId);
      setStep({ name: 'joined', identity });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        await lookUpPlaces(code); // refresh first — the taken place drops off
        setError(t('join.errorPlaceTaken')); // then announce
      } else {
        setError(t('join.errorJoining'));
      }
    } finally {
      setBusy(false);
    }
  }

  /*
   * Once joined, the dish screen owns the whole page rather than rendering
   * inside this one's `<main>`. It is a screen in its own right, and — more to
   * the point — its dead ends (a deleted contest, a lapsed session) have to be
   * able to drop the header the way the other screens' do. Nested inside here
   * they could not.
   */
  if (step.name === 'joined') return <YourDish identity={step.identity} />;

  const open = step.name === 'choosing' ? step.places.filter((p) => !p.taken) : [];

  return (
    <>
      <Nav />
      <main id="main" className="pt-main">
        {step.name === 'recognizing' && (
          <p role="status" className={styles.lead}>
            {t('common.loading')}
          </p>
        )}

        {step.name === 'code' && (
          <div className={styles.centred}>
            {/*
              The "?" stands in for the count a real contest would show. It
              appears only when a code was not recognised — there is nothing to
              count before one is, and an empty numeral slot on the way in would
              be furniture rather than information.
            */}
            {error ? (
              <div className={`${styles.figure} ${styles.figureUnknown}`} aria-hidden="true">
                ?
              </div>
            ) : null}
            <h1 className={styles.title}>{t('join.codeTitle')}</h1>
            <p className={styles.lead}>{t('join.codeLead')}</p>
            <form onSubmit={onSubmitCode} noValidate>
              <div className={`${styles.panel} ${error ? styles.panelError : ''}`}>
                <FormField
                  id="join-code"
                  label={t('join.codeLabel')}
                  className={`${styles.code} ${error ? styles.codeError : ''}`}
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'join-code-problem' : undefined}
                  value={code}
                  onChange={(e) => setCode(normalise(e.target.value))}
                />
                {/*
                  Attached to the field that was wrong, inside its own panel —
                  not a banner above a title that still says "Join the contest".
                */}
                {error ? (
                  <p id="join-code-problem" className={styles.fieldError} role="alert">
                    <WarningCircle size={18} weight="duotone" aria-hidden="true" />
                    <span>{error}</span>
                  </p>
                ) : null}
              </div>
              <Button type="submit" block disabled={busy || !code}>
                {busy ? t('join.checking') : error ? t('join.tryAgain') : t('join.continue')}
              </Button>
            </form>
          </div>
        )}

        {step.name === 'choosing' && open.length > 0 && (
          <div className={styles.top}>
            {/*
              How many are cooking. The handoff shows the contest's dish count
              here, which nothing knows yet — dishes are entered after joining —
              so this is the roster's size, which is the number that exists at
              this moment and is the one a cook is looking for.
            */}
            <div className={styles.figure} aria-hidden="true">
              {step.places.length}
            </div>
            <h1 className={styles.title}>{t('join.chooseTitle')}</h1>
            <p className={styles.lead}>{t('join.chooseLead')}</p>

            {error ? (
              <p className={styles.fieldError} role="alert">
                <WarningCircle size={18} weight="duotone" aria-hidden="true" />
                <span>{error}</span>
              </p>
            ) : null}

            <ul className={styles.places} aria-label={t('join.openPlaces')}>
              {step.places.map((place) =>
                place.taken ? (
                  /*
                    Still listed, so the roster reads as the real one and a cook
                    can tell "somebody took my name" from "wrong contest". Not a
                    button: there is nothing to press. The word carries it as
                    well as the dimming, because dimming alone is colour.
                  */
                  <li key={place.participantId} className={styles.taken}>
                    <span>{place.displayName}</span>
                    <span className={styles.tag}>{t('join.taken')}</span>
                  </li>
                ) : (
                  <li key={place.participantId}>
                    <button
                      type="button"
                      className={styles.place}
                      disabled={busy}
                      onClick={() => void onChoose(place)}
                    >
                      <span>{place.displayName}</span>
                      <ArrowRight
                        className={styles.placeArrow}
                        size={22}
                        weight="duotone"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                ),
              )}
            </ul>
            <p className={styles.footnote}>{t('join.refreshNote')}</p>
          </div>
        )}

        {/*
          Every place taken. Its own screen rather than one muted line: the
          roster is named so a cook can see it is the contest they meant, and
          there is a way out rather than a dead end.
        */}
        {step.name === 'choosing' && open.length === 0 && (
          <div className={styles.top}>
            <h1 className={styles.title}>{t('join.allTakenTitle')}</h1>
            <p className={styles.lead}>{t('join.allTakenLead')}</p>
            <ul className={styles.roster} aria-label={t('join.openPlaces')}>
              {step.places.map((place) => (
                <li key={place.participantId} className={styles.rosterRow}>
                  <span>{place.displayName}</span>
                  <span className={styles.tag}>{t('join.taken')}</span>
                </li>
              ))}
            </ul>
            <Button variant="ghost" block onClick={() => setStep({ name: 'code' })}>
              {t('join.tryAnotherCode')}
            </Button>
          </div>
        )}
      </main>
    </>
  );
}
