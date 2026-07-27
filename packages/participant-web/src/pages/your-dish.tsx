import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, FormField } from '@tapas/ui';
import { getDishes, submitDish, type Dish, type Identity } from '../api/client';

/**
 * The cook's dish, once they have joined: register (or revise) the dish they
 * brought — a name and an optional description — and see the dishes submitted so
 * far. Re-submitting updates their one dish rather than adding a second (the
 * screen pre-fills it from the roster). Scoring opens later, from here.
 */
export function YourDish({ identity }: { identity: Identity }) {
  const { t } = useTranslation();
  const [dishes, setDishes] = useState<readonly Dish[] | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [nameError, setNameError] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const mine = dishes?.find((dish) => dish.submitterIds.includes(identity.participantId));

  useEffect(() => {
    let live = true;
    getDishes(identity.contestId)
      .then((list) => {
        if (!live) return;
        setDishes(list);
        const own = list.find((dish) => dish.submitterIds.includes(identity.participantId));
        if (own) {
          setName(own.name);
          setDescription(own.description ?? '');
        }
      })
      .catch(() => live && setDishes([]));
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
      setDishes(await getDishes(identity.contestId));
      setSaved(true);
    } catch {
      setNameError(t('yourDish.errorSave'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-dish">
      <h1 className="pt-title">{t('yourDish.title', { name: identity.displayName })}</h1>
      <p className="pt-lead">{t('yourDish.lead')}</p>

      <form className="pt-form" onSubmit={onSubmit} noValidate>
        <FormField
          id="dish-name"
          label={t('yourDish.dishName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />
        <FormField
          id="dish-description"
          label={t('yourDish.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" block disabled={busy}>
          {busy ? t('yourDish.saving') : mine ? t('yourDish.update') : t('yourDish.submit')}
        </Button>
      </form>
      {saved ? (
        <p className="pt-note" role="status">
          Saved — your dish is in.
        </p>
      ) : null}

      <h2 className="pt-subhead">{t('yourDish.dishesSoFar')}</h2>
      {dishes === null ? (
        <p className="pt-note" role="status">
          {t('yourDish.loadingDishes')}
        </p>
      ) : dishes.length === 0 ? (
        <p className="pt-note">{t('yourDish.noDishes')}</p>
      ) : (
        <ul className="pt-dishes" aria-label={t('yourDish.dishesLabel')}>
          {dishes.map((dish) => (
            <li key={dish.dishId} className="pt-dish-row">
              <span className="pt-dish-name">{dish.name}</span>
              {dish.submitterIds.includes(identity.participantId) ? (
                <span className="pt-yours">{t('yourDish.yours')}</span>
              ) : null}
              {dish.description ? <span className="pt-dish-desc">{dish.description}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <p className="pt-note pt-wait">{t('yourDish.waiting')}</p>
      <Link to="/score" className="pt-score-link">
        {t('yourDish.scoreLink')}
      </Link>
    </section>
  );
}
