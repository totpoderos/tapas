import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, FormField } from '@tapas/ui';
import {
  ApiError,
  getDraft,
  publishDraft,
  updateDraft,
  type Attribution,
  type AntiBias,
  type DraftContent,
  type ScoreRange,
} from '../api/client';
import styles from './review-draft.module.css';

const ATTRIBUTION: readonly { value: Attribution; labelKey: string }[] = [
  { value: 'per_person', labelKey: 'attributionPerPerson' },
  { value: 'per_couple', labelKey: 'attributionPerCouple' },
];
const ANTI_BIAS: readonly { value: AntiBias; labelKey: string }[] = [
  { value: 'none', labelKey: 'antiBiasNone' },
  { value: 'couples', labelKey: 'antiBiasCouples' },
  { value: 'arbitrary_pairs', labelKey: 'antiBiasArbitrary' },
];

interface Category {
  readonly key: string;
  readonly name: string;
}
interface EditPerson {
  readonly id: string;
  readonly displayName: string;
  readonly partnerId: string | null;
  readonly noScoreWith: readonly string[];
}

type State =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'missing' }
  | { readonly kind: 'error' };

/**
 * Reviewing and editing a draft before it goes live. The host can change any of
 * the rules — attribution, anti-bias, scoring, who is taking part, couple
 * pairings, and who may not score whom — save the draft, and publish it when
 * ready. Only a name is required to save; the full rules are checked at publish,
 * and a publish failure is surfaced with the API's own reason.
 */
export function ReviewDraft() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const nextKey = useRef(0);
  const freshId = () => `new-${nextKey.current++}`;

  const [state, setState] = useState<State>({ kind: 'loading' });
  const [name, setName] = useState('');
  const [attribution, setAttribution] = useState<Attribution>('per_person');
  const [antiBias, setAntiBias] = useState<AntiBias>('none');
  const [categories, setCategories] = useState<Category[]>([]);
  const [rangeType, setRangeType] = useState<'auto' | 'fixed'>('auto');
  const [rangeMin, setRangeMin] = useState('1');
  const [rangeMax, setRangeMax] = useState('10');
  const [uniquePerCategory, setUniquePerCategory] = useState(true);
  const [people, setPeople] = useState<EditPerson[]>([]);
  const [personDraft, setPersonDraft] = useState('');

  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    getDraft(id)
      .then((draft) => {
        if (!live) return;
        const c = draft.content;
        setName(c.name);
        setAttribution(c.attribution ?? 'per_person');
        setAntiBias(c.antiBias ?? 'none');
        setCategories((c.scoring?.categories ?? []).map((cat) => ({ key: freshId(), name: cat.name })));
        const range = c.scoring?.range;
        setRangeType(range?.type === 'fixed' ? 'fixed' : 'auto');
        if (range?.type === 'fixed') {
          setRangeMin(String(range.min));
          setRangeMax(String(range.max));
        }
        setUniquePerCategory(c.scoring?.uniquePerCategory ?? true);
        setPeople(
          (c.participants ?? []).map((p) => ({
            id: p.id,
            displayName: p.displayName,
            partnerId: p.partnerId ?? null,
            noScoreWith: p.noScoreWith ?? [],
          })),
        );
        setState({ kind: 'ready' });
      })
      .catch((caught) => {
        if (!live) return;
        setState(caught instanceof ApiError && caught.status === 404 ? { kind: 'missing' } : { kind: 'error' });
      });
    return () => {
      live = false;
    };
  }, [id]);

  function addPerson() {
    const value = personDraft.trim();
    if (!value) return;
    setPeople((ps) => [...ps, { id: freshId(), displayName: value, partnerId: null, noScoreWith: [] }]);
    setPersonDraft('');
  }

  /** Removes a person and every reference to them (a partner back-link, any no-score entries). */
  function removePerson(personId: string) {
    setPeople((ps) =>
      ps
        .filter((p) => p.id !== personId)
        .map((p) => ({
          ...p,
          partnerId: p.partnerId === personId ? null : p.partnerId,
          noScoreWith: p.noScoreWith.filter((n) => n !== personId),
        })),
    );
  }

  /** Pairs two people as a couple, reciprocally; clearing one clears both. */
  function setPartner(personId: string, partnerId: string | null) {
    setPeople((ps) => {
      const previous = ps.find((p) => p.id === personId)?.partnerId ?? null;
      return ps.map((p) => {
        if (p.id === personId) return { ...p, partnerId };
        if (partnerId && p.id === partnerId) return { ...p, partnerId: personId };
        // Break the old pairing's back-link, and any other person that pointed here.
        if (p.id === previous || (p.partnerId === personId && p.id !== partnerId)) return { ...p, partnerId: null };
        return p;
      });
    });
  }

  function toggleNoScore(personId: string, otherId: string) {
    setPeople((ps) =>
      ps.map((p) =>
        p.id === personId
          ? {
              ...p,
              noScoreWith: p.noScoreWith.includes(otherId)
                ? p.noScoreWith.filter((n) => n !== otherId)
                : [...p.noScoreWith, otherId],
            }
          : p,
      ),
    );
  }

  function buildContent(): DraftContent {
    const range: ScoreRange =
      rangeType === 'fixed' ? { type: 'fixed', min: Number(rangeMin), max: Number(rangeMax) } : { type: 'auto' };
    return {
      name: name.trim(),
      attribution,
      antiBias,
      scoring: {
        categories: categories
          .map((c) => c.name.trim())
          .filter(Boolean)
          .map((label, i) => ({ id: `c${i + 1}`, name: label })),
        range,
        uniquePerCategory,
      },
      participants: people.map((p) => ({
        id: p.id,
        displayName: p.displayName.trim(),
        ...(p.partnerId ? { partnerId: p.partnerId } : {}),
        ...(p.noScoreWith.length ? { noScoreWith: p.noScoreWith } : {}),
      })),
    };
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setSaved(false);
    if (!name.trim()) {
      setNameError(t('reviewDraft.nameRequired'));
      return;
    }
    setNameError(undefined);
    setSaving(true);
    try {
      await updateDraft(id, buildContent());
      setSaved(true);
    } catch {
      setError(t('reviewDraft.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function onPublish() {
    setError(undefined);
    setPublishing(true);
    try {
      await publishDraft(id);
      navigate('/'); // it is a live contest now; the list shows it as such
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? t('reviewDraft.publishError', { reason: caught.message })
          : t('reviewDraft.publishErrorGeneric'),
      );
      setPublishing(false);
    }
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>{t('common.brand')}</b>
        </div>
        <Link to="/" className={styles.back}>
          {t('reviewDraft.back')}
        </Link>
      </div>

      {state.kind === 'loading' && (
        <p role="status" className={styles.note}>
          {t('reviewDraft.loading')}
        </p>
      )}
      {state.kind === 'missing' && (
        <>
          <h1 className={styles.title}>{t('reviewDraft.notFoundTitle')}</h1>
          <p className={styles.note}>{t('reviewDraft.notFoundBody')}</p>
        </>
      )}
      {state.kind === 'error' && (
        <p role="alert" className={styles.note}>
          {t('reviewDraft.loadError')}
        </p>
      )}

      {state.kind === 'ready' && (
        <>
          <h1 className={styles.title}>{t('reviewDraft.editTitle', { name })}</h1>
          <p className={styles.lead}>{t('reviewDraft.lead')}</p>

          {error ? (
            <div className={styles.alert} role="alert">
              <span aria-hidden="true">✕</span>
              <span>{error}</span>
            </div>
          ) : null}
          {saved ? (
            <p className={styles.saved} role="status">
              {t('reviewDraft.saved')}
            </p>
          ) : null}

          <form className={styles.form} onSubmit={onSave} noValidate>
            <FormField
              id="draft-name"
              label={t('reviewDraft.nameLabel')}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              error={nameError}
            />

            <fieldset className={styles.group}>
              <legend className={styles.legend}>{t('reviewDraft.attributionLegend')}</legend>
              <div className={styles.choices}>
                {ATTRIBUTION.map((option) => (
                  <label key={option.value} className={styles.choice}>
                    <input
                      type="radio"
                      name="attribution"
                      checked={attribution === option.value}
                      onChange={() => setAttribution(option.value)}
                    />
                    {t(`reviewDraft.${option.labelKey}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>{t('reviewDraft.antiBiasLegend')}</legend>
              <div className={styles.choices}>
                {ANTI_BIAS.map((option) => (
                  <label key={option.value} className={styles.choice}>
                    <input
                      type="radio"
                      name="anti-bias"
                      checked={antiBias === option.value}
                      onChange={() => setAntiBias(option.value)}
                    />
                    {t(`reviewDraft.${option.labelKey}`)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>{t('reviewDraft.scoringLegend')}</legend>
              <ul className={styles.rows} aria-label={t('reviewDraft.scoringCategoriesLabel')}>
                {categories.map((category, index) => (
                  <li key={category.key} className={styles.row}>
                    <input
                      aria-label={t('reviewDraft.categoryName', { number: index + 1 })}
                      value={category.name}
                      onChange={(e) =>
                        setCategories((rows) =>
                          rows.map((r) => (r.key === category.key ? { ...r, name: e.target.value } : r)),
                        )
                      }
                    />
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={t('reviewDraft.removeCategory', { number: index + 1 })}
                      onClick={() => setCategories((rows) => rows.filter((r) => r.key !== category.key))}
                    >
                      {t('reviewDraft.remove')}
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={styles.add}
                onClick={() => setCategories((r) => [...r, { key: freshId(), name: '' }])}
              >
                {t('reviewDraft.addCategory')}
              </button>

              <fieldset className={styles.group} style={{ marginTop: 20 }}>
                <legend className={styles.legend}>{t('reviewDraft.rangeLegend')}</legend>
                <div className={styles.choices}>
                  <label className={styles.choice}>
                    <input type="radio" name="range" checked={rangeType === 'auto'} onChange={() => setRangeType('auto')} />
                    {t('reviewDraft.rangeAuto')}
                  </label>
                  <label className={styles.choice}>
                    <input type="radio" name="range" checked={rangeType === 'fixed'} onChange={() => setRangeType('fixed')} />
                    {t('reviewDraft.rangeFixed')}
                  </label>
                </div>
                {rangeType === 'fixed' ? (
                  <div className={styles.inline} style={{ marginTop: 12 }}>
                    <div className={styles.numberField}>
                      <label htmlFor="range-min">{t('reviewDraft.rangeMin')}</label>
                      <input id="range-min" type="number" value={rangeMin} onChange={(e) => setRangeMin(e.target.value)} />
                    </div>
                    <div className={styles.numberField}>
                      <label htmlFor="range-max">{t('reviewDraft.rangeMax')}</label>
                      <input id="range-max" type="number" value={rangeMax} onChange={(e) => setRangeMax(e.target.value)} />
                    </div>
                  </div>
                ) : null}
              </fieldset>

              <label className={styles.choice} style={{ marginTop: 16 }}>
                <input
                  type="checkbox"
                  checked={uniquePerCategory}
                  onChange={(e) => setUniquePerCategory(e.target.checked)}
                />
                {t('reviewDraft.uniquePerCategory')}
              </label>
            </fieldset>

            <fieldset className={styles.group}>
              <legend className={styles.legend}>{t('reviewDraft.participants')}</legend>
              <div className={styles.row}>
                <input
                  aria-label={t('reviewDraft.newParticipantLabel')}
                  value={personDraft}
                  onChange={(e) => setPersonDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addPerson();
                    }
                  }}
                />
                <button type="button" className={styles.remove} onClick={addPerson}>
                  {t('reviewDraft.add')}
                </button>
              </div>

              {people.length === 0 ? (
                <p className={styles.empty}>{t('reviewDraft.emptyParticipants')}</p>
              ) : (
                <ul className={styles.rows} aria-label={t('reviewDraft.participants')}>
                  {people.map((person, index) => {
                    const others = people.filter((p) => p.id !== person.id);
                    const fallbackName =
                      person.displayName || t('reviewDraft.participantFallback', { number: index + 1 });
                    return (
                      <li key={person.id} className={styles.personRow}>
                        <div className={styles.row}>
                          <input
                            aria-label={t('reviewDraft.participantName', { number: index + 1 })}
                            value={person.displayName}
                            onChange={(e) =>
                              setPeople((ps) =>
                                ps.map((p) => (p.id === person.id ? { ...p, displayName: e.target.value } : p)),
                              )
                            }
                          />
                          <label className={styles.partner}>
                            <span className={styles.partnerLabel}>{t('reviewDraft.partnerLabel')}</span>
                            <select
                              aria-label={t('reviewDraft.partnerOf', { name: fallbackName })}
                              value={person.partnerId ?? ''}
                              onChange={(e) => setPartner(person.id, e.target.value || null)}
                            >
                              <option value="">{t('reviewDraft.partnerNone')}</option>
                              {others.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.displayName || t('reviewDraft.unnamed')}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className={styles.remove}
                            aria-label={t('reviewDraft.removePerson', { name: fallbackName })}
                            onClick={() => removePerson(person.id)}
                          >
                            {t('reviewDraft.remove')}
                          </button>
                        </div>
                        {others.length > 0 ? (
                          <details className={styles.noScore}>
                            <summary>{t('reviewDraft.cantScore')}</summary>
                            <ul className={styles.noScoreList}>
                              {others.map((o) => (
                                <li key={o.id}>
                                  <label className={styles.choice}>
                                    <input
                                      type="checkbox"
                                      checked={person.noScoreWith.includes(o.id)}
                                      onChange={() => toggleNoScore(person.id, o.id)}
                                    />
                                    {o.displayName || t('reviewDraft.unnamed')}
                                  </label>
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>

            <div className={styles.actions}>
              <Button type="submit" disabled={saving}>
                {saving ? t('reviewDraft.saving') : t('reviewDraft.save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => void onPublish()} disabled={publishing}>
                {publishing ? t('reviewDraft.publishing') : t('reviewDraft.publish')}
              </Button>
              <Link to="/" className={styles.back}>
                {t('reviewDraft.cancel')}
              </Link>
            </div>
          </form>
        </>
      )}
    </main>
  );
}
