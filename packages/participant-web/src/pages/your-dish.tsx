import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle } from '@phosphor-icons/react/dist/ssr';
import { Button, FormField } from '@tapas/ui';
import { Nav } from '../nav';
import styles from './your-dish.module.css';
import { PlainScreen } from '../plain-screen';
import { BottomBar } from '../bottom-bar';
import { useVoteStanding } from '../use-vote-standing';
import { getDishes, isContestDeleted, isSignedOut, submitDish, type Dish, type Identity } from '../api/client';

/**
 * The cook's dish, once they have joined: register (or revise) the dish they
 * brought — a name and an optional description — and see the dishes submitted so
 * far. Re-submitting updates their one dish rather than adding a second (the
 * screen pre-fills it from the roster). Scoring opens later, from here.
 */
export function YourDish({ identity }: { identity: Identity }) {
  const { t } = useTranslation();
  const [dishes, setDishes] = useState<readonly Dish[] | null>(null);
  /** How many dishes the contest is waiting for — one per place on the roster. */
  const [expected, setExpected] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  /*
   * This screen is where a cook waits, and where the handoff says they should
   * learn that scoring has opened — from the mark on the bar, not from a banner
   * on a screen they are not looking at.
   */
  const standing = useVoteStanding(identity.contestId);

  const mine = dishes?.find((dish) => dish.submitterIds.includes(identity.participantId));

  useEffect(() => {
    let live = true;
    getDishes(identity.contestId)
      .then(({ dishes: list, expected: count }) => {
        if (!live) return;
        setDishes(list);
        setExpected(count);
        const own = list.find((dish) => dish.submitterIds.includes(identity.participantId));
        if (own) {
          setName(own.name);
          setDescription(own.description ?? '');
        }
      })
      .catch((caught: unknown) => {
        if (!live) return;
        // The host deleted the contest — say so rather than showing an empty list
        // as if nobody had entered a dish yet.
        if (isContestDeleted(caught)) setGone(true);
        else if (isSignedOut(caught)) setSignedOut(true);
        else setDishes([]);
      });
    return () => {
      live = false;
    };
  }, [identity.contestId, identity.participantId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    if (!name.trim()) {
      setNameError(t('yourDish.errorNameRequired'));
      return;
    }
    setNameError(undefined);
    setBusy(true);
    try {
      await submitDish(identity.contestId, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      const refreshed = await getDishes(identity.contestId);
      setDishes(refreshed.dishes);
      setExpected(refreshed.expected);
      setSaved(true);
    } catch (caught) {
      if (isContestDeleted(caught)) setGone(true);
      // Not signed in: retrying cannot succeed, so send them back to joining
      // rather than showing "try again" — the shape of the Safari defect.
      else if (isSignedOut(caught)) setSignedOut(true);
      else setNameError(t('yourDish.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  if (signedOut) {
    return (
      <PlainScreen
        kind="signedOut"
        title={t('yourDish.signedOutTitle')}
        lead={t('yourDish.signedOutLead')}
        actionLabel={t('yourDish.goToJoin')}
        actionTo="/"
      />
    );
  }

  if (gone) {
    return (
      <PlainScreen
        kind="gone"
        title={t('yourDish.goneTitle')}
        lead={t('yourDish.goneLead')}
        actionLabel={t('common.joinAnother', 'Join another contest')}
        actionTo="/"
      />
    );
  }

  return (
    <>
      <Nav context={identity.displayName} />
      <main id="main" className="pt-main pt-barred">
      <div className={styles.screen}>
        <h1 className={styles.title}>{t('yourDish.title', { name: identity.displayName })}</h1>
        <p className={styles.lead}>{t('yourDish.lead')}</p>

        {/* The dish, its description and the action that saves them, in one panel. */}
        <form onSubmit={onSubmit} noValidate>
          <div className={styles.panel}>
            <FormField
              id="dish-name"
              label={t('yourDish.dishName')}
              className={styles.name}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
            />
            <FormField
              id="dish-description"
              label={t('yourDish.description')}
              className={styles.description}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" block disabled={busy}>
              {busy ? t('yourDish.saving') : mine ? t('yourDish.update') : t('yourDish.submit')}
            </Button>
            {/*
              Inside the panel, under what it is about — the same rule the join
              code's error follows. This line used to be a bare English string
              that never went through `t()`, so a cook reading in Spanish was
              told in English that their dish was in.
            */}
            {saved ? (
              <p className={styles.saved} role="status">
                <CheckCircle size={18} weight="duotone" aria-hidden="true" />
                <span>{t('yourDish.savedConfirmation')}</span>
              </p>
            ) : null}
          </div>
        </form>

        {dishes === null ? (
          <p className={styles.note} role="status">
            {t('yourDish.loadingDishes')}
          </p>
        ) : (
          <>
            {/*
              How many are in, out of how many are coming. "Two dishes are in"
              alone does not tell a cook whether to keep waiting; against the
              number expected, it does.
            */}
            {/*
              `submitted`, not `count` — i18next treats a variable named `count`
              as the plural selector and would look for `countIn_one` /
              `countIn_other` keys that do not exist.
            */}
            <h2 className={styles.count}>
              {t('yourDish.countIn', { submitted: dishes.length, expected })}
            </h2>
            {dishes.length === 0 ? (
              <p className={styles.note}>{t('yourDish.noDishes')}</p>
            ) : (
              <ul className={styles.dishes} aria-label={t('yourDish.dishesLabel')}>
                {dishes.map((dish) => (
                  <li key={dish.dishId} className={styles.dishRow}>
                    <span className={styles.dishName}>{dish.name}</span>
                    {dish.submitterIds.includes(identity.participantId) ? (
                      <span className={styles.yours}>{t('yourDish.yours')}</span>
                    ) : null}
                    {dish.description ? (
                      <span className={styles.dishDescription}>{dish.description}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {/*
          Kept from before the restyle. It is guidance, not chrome: it says when
          scoring becomes the thing to do, which nothing else on the screen does.
          The link that sat beside it is gone — the ways onward already offer it.
        */}
        <p className={styles.note}>{t('yourDish.waiting')}</p>
      </div>
      </main>
      <BottomBar current="dish" standing={standing} />
    </>
  );
}
