import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { Button, Callout, Card, FormField } from '@tapas/ui';
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
import { useContests } from '../contests/contests-provider';
import { PanelActions, PanelNote } from '../shell/panel-actions';
import styles from './review-draft.module.css';

/** A stable id, so the header's Save button can name the form it submits. */
const FORM_ID = 'review-draft-form';

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
  const [categoryDraft, setCategoryDraft] = useState('');
  const [people, setPeople] = useState<EditPerson[]>([]);
  const [personDraft, setPersonDraft] = useState('');

  const [nameError, setNameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { refresh: refreshContests } = useContests();

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
        /*
         * Barring is mutual, so it is made mutual on the way in — an older draft may
         * hold one direction only, from when this screen wrote just the one. Doing it
         * here rather than at save keeps everything downstream simple: the pairs
         * list, the editor and what gets stored all see the same symmetric thing.
         */
        const loaded = c.participants ?? [];
        const barred = new Map<string, Set<string>>(
          loaded.map((p) => [p.id, new Set(p.noScoreWith ?? [])]),
        );
        for (const person of loaded) {
          for (const againstId of person.noScoreWith ?? []) {
            barred.get(againstId)?.add(person.id);
          }
        }
        setPeople(
          loaded.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            partnerId: p.partnerId ?? null,
            noScoreWith: [...(barred.get(p.id) ?? [])],
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

  function addCategory() {
    const value = categoryDraft.trim();
    if (!value) return;
    setCategories((cs) => [...cs, { key: freshId(), name: value }]);
    setCategoryDraft('');
  }

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

  /**
   * Bars two people from scoring each other — both ways.
   *
   * The rule is offered as "chosen pairs cannot score each other", and it used to
   * write one direction only, so barring Núria from scoring Pau left Pau free to
   * score Núria. Pairing on this same screen was already reciprocal; barring is now
   * too, which is all the compiler needs to keep the promise the option makes.
   */
  function barPair(oneId: string, otherId: string) {
    if (oneId === otherId) return;
    setPeople((ps) =>
      ps.map((p) => {
        if (p.id !== oneId && p.id !== otherId) return p;
        const against = p.id === oneId ? otherId : oneId;
        return p.noScoreWith.includes(against)
          ? p
          : { ...p, noScoreWith: [...p.noScoreWith, against] };
      }),
    );
  }

  /** Lifts a bar, both ways — including a half of one left by an older draft. */
  function liftPair(oneId: string, otherId: string) {
    setPeople((ps) =>
      ps.map((p) =>
        p.id === oneId || p.id === otherId
          ? { ...p, noScoreWith: p.noScoreWith.filter((n) => n !== oneId && n !== otherId) }
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
      // The panel names this contest and says what state it is in, from the shared
      // list — which still has it as a draft until told otherwise. Without this the
      // control room opens under a sidebar insisting the live contest is a draft.
      refreshContests();
      // Straight to the control room rather than back to the list: the contest is
      // live, and the join code is the very next thing the host needs.
      navigate(`/contest/${id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? t('reviewDraft.publishError', { reason: caught.message })
          : t('reviewDraft.publishErrorGeneric'),
      );
      setPublishing(false);
    }
  }

  /** Who has nobody to be paired with — only a problem when scoring is per couple. */
  const unpartnered = attribution === 'per_couple' ? people.filter((p) => !p.partnerId) : [];
  const couples = new Set(
    people.filter((p) => p.partnerId).map((p) => [p.id, p.partnerId].sort().join('~')),
  ).size;

  /**
   * The pairs barred from scoring each other, each counted once.
   *
   * Read from both sides, so a half-bar left by an older draft still shows as the
   * pair it was meant to be — and saving makes it mutual for good.
   */
  const barredPairs = (() => {
    const seen = new Map<string, { one: EditPerson; other: EditPerson }>();
    for (const person of people) {
      for (const againstId of person.noScoreWith) {
        const other = people.find((p) => p.id === againstId);
        if (!other) continue;
        const key = [person.id, other.id].sort().join('~');
        if (!seen.has(key)) seen.set(key, { one: person, other });
      }
    }
    return [...seen.values()];
  })();

  const nameOf = (person: EditPerson, index: number) =>
    person.displayName || t('reviewDraft.participantFallback', { number: index + 1 });

  return (
    <main id="main">
      {state.kind === 'ready' && (
        <PanelActions>
          {/* Announced where it happens, so a host is not left wondering whether a
              change took — a form that swallows a save is one saved twice. */}
          <span role="status" className={styles.savedNote}>
            {saved ? t('reviewDraft.saved') : ''}
          </span>
          <Button type="submit" form={FORM_ID} variant="ghost" disabled={saving}>
            {saving ? t('reviewDraft.saving') : t('reviewDraft.save')}
          </Button>
          <Button onClick={() => void onPublish()} disabled={publishing}>
            {publishing ? t('reviewDraft.publishing') : t('reviewDraft.publish')}
          </Button>
        </PanelActions>
      )}

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

      {/* What the draft still needs, where the host sees it without scrolling. The
          navigation cannot work this out: it knows the contest list, not what is
          inside a draft. Nothing at all when nothing is missing. */}
      {state.kind === 'ready' && unpartnered.length > 0 && (
        <PanelNote>
          <Callout tone="saffron" title={t('reviewDraft.beforePublishing')}>
            <p>{t('reviewDraft.checkWantingPartner', { count: unpartnered.length })}</p>
          </Callout>
        </PanelNote>
      )}

      {state.kind === 'ready' && (
        <>
          <div className={styles.heading}>
            <h1 className={styles.title}>{t('reviewDraft.editTitle', { name })}</h1>
            <p className={styles.lead}>{t('reviewDraft.lead')}</p>
          </div>

          {error ? (
            <div className={styles.wide}>
              <Callout tone="danger" role="alert">
                <p>{error}</p>
              </Callout>
            </div>
          ) : null}

          <form id={FORM_ID} className={styles.columns} onSubmit={onSave} noValidate>
            <div className={styles.main}>
              <Card>
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
              </Card>

              <Card>
                <fieldset className={styles.group}>
                  <legend className={styles.legend}>{t('reviewDraft.attributionLegend')}</legend>
                  <div className={styles.choices}>
                    {ATTRIBUTION.map((option) => (
                      <Choice
                        key={option.value}
                        name="attribution"
                        value={option.value}
                        checked={attribution === option.value}
                        onChoose={() => setAttribution(option.value)}
                      >
                        {t(`reviewDraft.${option.labelKey}`)}
                      </Choice>
                    ))}
                  </div>
                </fieldset>

                <fieldset className={styles.group}>
                  <legend className={styles.legend}>{t('reviewDraft.antiBiasLegend')}</legend>
                  <div className={styles.choices}>
                    {ANTI_BIAS.map((option) => (
                      <Choice
                        key={option.value}
                        name="anti-bias"
                        value={option.value}
                        checked={antiBias === option.value}
                        onChoose={() => setAntiBias(option.value)}
                      >
                        {t(`reviewDraft.${option.labelKey}`)}
                      </Choice>
                    ))}
                  </div>
                </fieldset>
              </Card>

              <Card>
                <fieldset className={styles.group}>
                  <legend className={styles.legend}>{t('reviewDraft.scoringLegend')}</legend>
                  <ul className={styles.chips} aria-label={t('reviewDraft.categoriesLabel')}>
                    {categories.map((category) => (
                      <li key={category.key} className={styles.chip}>
                        {category.name}
                        <button
                          type="button"
                          className={styles.chipRemove}
                          aria-label={t('reviewDraft.removeCategory', { name: category.name })}
                          onClick={() =>
                            setCategories((cs) => cs.filter((c) => c.key !== category.key))
                          }
                        >
                          <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className={styles.addRow}>
                    <input
                      className={styles.input}
                      aria-label={t('reviewDraft.newCategoryLabel')}
                      value={categoryDraft}
                      onChange={(e) => setCategoryDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCategory();
                        }
                      }}
                    />
                    <Button variant="ghost" onClick={addCategory}>
                      {t('reviewDraft.addCategory')}
                    </Button>
                  </div>
                </fieldset>

                <fieldset className={styles.group}>
                  <legend className={styles.legend}>{t('reviewDraft.rangeLegend')}</legend>
                  <div className={styles.sideBySide}>
                    <Choice
                      name="range"
                      value="auto"
                      checked={rangeType === 'auto'}
                      onChoose={() => setRangeType('auto')}
                    >
                      {t('reviewDraft.rangeAuto')}
                    </Choice>
                    <Choice
                      name="range"
                      value="fixed"
                      checked={rangeType === 'fixed'}
                      onChoose={() => setRangeType('fixed')}
                    >
                      {t('reviewDraft.rangeFixed')}
                    </Choice>
                  </div>
                  {rangeType === 'fixed' ? (
                    <div className={styles.inline}>
                      <FormField
                        id="range-min"
                        type="number"
                        label={t('reviewDraft.rangeMin')}
                        value={rangeMin}
                        onChange={(e) => setRangeMin(e.target.value)}
                      />
                      <FormField
                        id="range-max"
                        type="number"
                        label={t('reviewDraft.rangeMax')}
                        value={rangeMax}
                        onChange={(e) => setRangeMax(e.target.value)}
                      />
                    </div>
                  ) : null}
                </fieldset>

                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={uniquePerCategory}
                    onChange={(e) => setUniquePerCategory(e.target.checked)}
                  />
                  {t('reviewDraft.uniquePerCategory')}
                </label>
              </Card>

              <Card
                title={t('reviewDraft.participantsTitle')}
                aside={t('reviewDraft.peopleAndCouples', { people: people.length, couples })}
              >
                <div className={styles.addRow}>
                  <input
                    className={styles.input}
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
                  <Button variant="ghost" onClick={addPerson}>
                    {t('reviewDraft.add')}
                  </Button>
                </div>

                {people.length === 0 ? (
                  <p className={styles.empty}>{t('reviewDraft.emptyParticipants')}</p>
                ) : (
                  <ul className={styles.people} aria-label={t('reviewDraft.participants')}>
                    {people.map((person, index) => {
                      const others = people.filter((p) => p.id !== person.id);
                      const needsPartner = attribution === 'per_couple' && !person.partnerId;
                      return (
                        <li key={person.id} className={styles.personRow}>
                          <input
                            className={styles.input}
                            aria-label={t('reviewDraft.participantName', { number: index + 1 })}
                            value={person.displayName}
                            onChange={(e) =>
                              setPeople((ps) =>
                                ps.map((p) =>
                                  p.id === person.id ? { ...p, displayName: e.target.value } : p,
                                ),
                              )
                            }
                          />
                          <label className={styles.partner}>
                            <span className={styles.partnerLabel}>
                              {t('reviewDraft.partnerLabel')}
                            </span>
                            <select
                              className={`${styles.select} ${needsPartner ? styles.wanting : ''}`}
                              aria-label={t('reviewDraft.partnerOf', {
                                name: nameOf(person, index),
                              })}
                              aria-describedby={needsPartner ? `${person.id}-wanting` : undefined}
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
                          {/* Said in words, not only by a red edge. */}
                          {needsPartner ? (
                            <span id={`${person.id}-wanting`} className={styles.wantingNote}>
                              {t('reviewDraft.needsPartner')}
                            </span>
                          ) : null}
                          <Button
                            variant="ghost"
                            aria-label={t('reviewDraft.removePerson', {
                              name: nameOf(person, index),
                            })}
                            onClick={() => removePerson(person.id)}
                          >
                            {t('reviewDraft.remove')}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            </div>

            <div className={styles.aside}>
              <Card title={t('reviewDraft.checklistTitle')} level={3}>
                <PublishChecklist
                  nameSet={name.trim().length > 0}
                  categoryCount={categories.filter((c) => c.name.trim()).length}
                  range={rangeType === 'fixed' ? { min: rangeMin, max: rangeMax } : 'auto'}
                  wanting={unpartnered.length}
                />
              </Card>

              <Card title={t('reviewDraft.barredTitle')} level={3}>
                <p className={styles.cardHint}>{t('reviewDraft.barredHint')}</p>
                {barredPairs.length === 0 ? (
                  <p className={styles.empty}>{t('reviewDraft.noBarredPairs')}</p>
                ) : (
                  <ul className={styles.pairs} aria-label={t('reviewDraft.barredTitle')}>
                    {barredPairs.map(({ one, other }) => {
                      const oneName = nameOf(one, people.indexOf(one));
                      const otherName = nameOf(other, people.indexOf(other));
                      return (
                        <li key={`${one.id}~${other.id}`} className={styles.pair}>
                          <span>
                            {oneName} <span aria-hidden="true">↔</span> {otherName}
                          </span>
                          <button
                            type="button"
                            className={styles.chipRemove}
                            aria-label={t('reviewDraft.liftBar', {
                              one: oneName,
                              other: otherName,
                            })}
                            onClick={() => liftPair(one.id, other.id)}
                          >
                            <span aria-hidden="true">×</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {people.length >= 2 ? (
                  <AddPair people={people} nameOf={nameOf} onBar={barPair} />
                ) : null}
              </Card>
            </div>
          </form>
        </>
      )}
    </main>
  );
}

/**
 * What is ready and what is not, worked out from the draft in front of the host.
 *
 * A prediction, not a verdict: publishing still asks the API and the API's answer
 * still governs. This exists so a host is not left pressing publish and reading a
 * refusal to find out what was missing.
 */
function PublishChecklist({
  nameSet,
  categoryCount,
  range,
  wanting,
}: {
  readonly nameSet: boolean;
  readonly categoryCount: number;
  readonly range: 'auto' | { min: string; max: string };
  readonly wanting: number;
}) {
  const { t } = useTranslation();
  const items = [
    { key: 'name', ready: nameSet, text: nameSet ? t('reviewDraft.checkName') : t('reviewDraft.checkNameMissing') },
    {
      key: 'categories',
      ready: categoryCount > 0,
      text:
        categoryCount > 0
          ? t('reviewDraft.checkCategories', { count: categoryCount })
          : t('reviewDraft.checkCategoriesMissing'),
    },
    {
      key: 'range',
      ready: true,
      text:
        range === 'auto'
          ? t('reviewDraft.checkRangeAuto')
          : t('reviewDraft.checkRangeFixed', { min: range.min, max: range.max }),
    },
    ...(wanting > 0
      ? [{ key: 'pairing', ready: false, text: t('reviewDraft.checkWantingPartner', { count: wanting }) }]
      : []),
  ];
  const ready = items.every((item) => item.ready);

  return (
    <>
      <ul className={styles.checklist}>
        {items.map((item) => (
          <li key={item.key} className={item.ready ? styles.done : styles.todo}>
            {/* A mark and a wording, never the colour alone. */}
            <span aria-hidden="true" className={styles.mark}>
              {item.ready ? '✓' : '!'}
            </span>
            {item.text}
          </li>
        ))}
      </ul>
      <p className={ready ? styles.readyNote : styles.notReadyNote} role="status">
        {ready ? t('reviewDraft.readyToPublish') : t('reviewDraft.notReadyToPublish')}
      </p>
    </>
  );
}

/** Choosing two people to bar from scoring each other. */
function AddPair({
  people,
  nameOf,
  onBar,
}: {
  readonly people: readonly EditPerson[];
  readonly nameOf: (person: EditPerson, index: number) => string;
  readonly onBar: (oneId: string, otherId: string) => void;
}) {
  const { t } = useTranslation();
  const [one, setOne] = useState('');
  const [other, setOther] = useState('');

  const options = people.map((person, index) => ({ id: person.id, name: nameOf(person, index) }));

  return (
    <div className={styles.addPair}>
      <label className={styles.pairPick}>
        <span className={styles.partnerLabel}>{t('reviewDraft.pairOne')}</span>
        <select className={styles.select} value={one} onChange={(e) => setOne(e.target.value)}>
          <option value="">{t('reviewDraft.pairChoose')}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.pairPick}>
        <span className={styles.partnerLabel}>{t('reviewDraft.pairOther')}</span>
        <select className={styles.select} value={other} onChange={(e) => setOther(e.target.value)}>
          <option value="">{t('reviewDraft.pairChoose')}</option>
          {options
            /* Nobody can be barred from scoring themselves, so they are not offered. */
            .filter((option) => option.id !== one)
            .map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
        </select>
      </label>
      <Button
        variant="ghost"
        disabled={!one || !other}
        onClick={() => {
          onBar(one, other);
          setOne('');
          setOther('');
        }}
      >
        {t('reviewDraft.barPair')}
      </Button>
    </div>
  );
}

/**
 * One choice, drawn as the design's card but a real radio underneath — the same
 * treatment the rule space uses, so setting a contest up and changing it later look
 * and behave alike.
 */
function Choice({
  name,
  value,
  checked,
  onChoose,
  children,
}: {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChoose: () => void;
  readonly children: ReactNode;
}) {
  return (
    <label className={`${styles.choiceCard} ${checked ? styles.chosen : ''}`}>
      <input type="radio" name={name} value={value} checked={checked} onChange={onChoose} />
      {children}
    </label>
  );
}
