import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, FormField } from '@tapas/ui';
import { getDishes, submitDish, type Dish, type Identity } from '../api/client';

/**
 * The cook's dish, once they have joined: register (or revise) the dish they
 * brought — a name and an optional description — and see the dishes submitted so
 * far. Re-submitting updates their one dish rather than adding a second (the
 * screen pre-fills it from the roster). Scoring opens later, from here.
 */
export function YourDish({ identity }: { identity: Identity }) {
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
      setNameError('Give your dish a name.');
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
      setNameError('Your dish couldn’t be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-dish">
      <h1 className="pt-title">Your dish, {identity.displayName}</h1>
      <p className="pt-lead">What did you bring? You can change it until scoring starts.</p>

      <form className="pt-form" onSubmit={onSubmit} noValidate>
        <FormField
          id="dish-name"
          label="Dish name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />
        <FormField
          id="dish-description"
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" block disabled={busy}>
          {busy ? 'Saving…' : mine ? 'Update dish' : 'Submit dish'}
        </Button>
      </form>
      {saved ? (
        <p className="pt-note" role="status">
          Saved — your dish is in.
        </p>
      ) : null}

      <h2 className="pt-subhead">Dishes so far</h2>
      {dishes === null ? (
        <p className="pt-note" role="status">
          Loading…
        </p>
      ) : dishes.length === 0 ? (
        <p className="pt-note">No dishes yet. Be the first.</p>
      ) : (
        <ul className="pt-dishes" aria-label="Dishes submitted">
          {dishes.map((dish) => (
            <li key={dish.dishId} className="pt-dish-row">
              <span className="pt-dish-name">{dish.name}</span>
              {dish.submitterIds.includes(identity.participantId) ? (
                <span className="pt-yours">Yours</span>
              ) : null}
              {dish.description ? <span className="pt-dish-desc">{dish.description}</span> : null}
            </li>
          ))}
        </ul>
      )}

      <p className="pt-note pt-wait">When the dishes are in, it’s time to score.</p>
      <Link to="/score" className="pt-score-link">
        Score the dishes →
      </Link>
    </section>
  );
}
