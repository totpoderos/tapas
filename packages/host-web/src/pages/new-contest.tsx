import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button, Callout, Card, FormField } from '@tapas/ui';
import {
  createDraft,
  type ContestFormat,
  type DraftContent,
  type ScoreRange,
} from '../api/client';
import { useContests } from '../contests/contests-provider';
import { PanelActions } from '../shell/panel-actions';
import styles from './new-contest.module.css';

interface Row {
  readonly id: string;
  readonly value: string;
}

/** A stable id so the header's Save button can name the form it submits. */
const FORM_ID = 'new-contest-form';

const FORMATS: readonly { value: ContestFormat; key: string }[] = [
  { value: 'solo', key: 'formatSolo' },
  { value: 'solo_with_partners', key: 'formatSoloWithPartners' },
  { value: 'couples', key: 'formatCouples' },
];


/**
 * The manual "create a contest" form (design.md §8, form path): the **rules** of a
 * new contest — name, format, scoring — saved as a draft.
 * Publishing it live is a later step. Only a name is required to save; the rest is
 * refined over time and fully checked at publish.
 *
 * Who is taking part is not asked for here. A contest is prepared in two sections
 * and this form is the first of them, so it hands over to the second rather than
 * asking for the same people twice and leaving two answers to reconcile. Pairing
 * and per-pair exclusions were always the other section's; the roster now joins
 * them.
 *
 * Two ways on, differing only in where they leave the host: *Save as draft* at
 * their contest list, *Next* on the new contest's participants. Both save, and
 * both are refused the same way when there is no name.
 *
 * No chrome of its own: the panel says where this is, and the actions go in the
 * panel's header where the actions for a whole surface belong.
 */
export function NewContest() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { refresh: refreshContests } = useContests();
  const nextId = useRef(0);
  const makeRow = (value = ''): Row => ({ id: `r${nextId.current++}`, value });

  const [name, setName] = useState('');
  const [format, setFormat] = useState<ContestFormat>('solo');
  const [categories, setCategories] = useState<Row[]>([makeRow('Taste')]);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [rangeType, setRangeType] = useState<'auto' | 'fixed'>('auto');
  const [rangeMin, setRangeMin] = useState('1');
  const [rangeMax, setRangeMax] = useState('10');
  const [uniquePerCategory, setUniquePerCategory] = useState(true);
  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  /** Which way on is in flight, so only that button says it is working. */
  const [saving, setSaving] = useState<'list' | 'people' | null>(null);

  function addCategory() {
    const value = categoryDraft.trim();
    if (!value) return;
    setCategories((rows) => [...rows, makeRow(value)]);
    setCategoryDraft('');
  }

  function buildContent(): DraftContent {
    const range: ScoreRange =
      rangeType === 'fixed'
        ? { type: 'fixed', min: Number(rangeMin), max: Number(rangeMax) }
        : { type: 'auto' };
    return {
      name: name.trim(),
      format,
      scoring: {
        /*
         * Names only: nothing here has an identity yet, and the API names each
         * category as it saves it, the way it names a participant given by name
         * alone. This used to send `c${i + 1}` from the row's position — identity
         * invented by the screen out of the order the host happened to type in.
         */
        categories: categories
          .map((c) => c.value.trim())
          .filter(Boolean)
          .map((label) => ({ name: label })),
        range,
        uniquePerCategory,
      },
    };
  }

  /**
   * Saves the contest and goes on: to the host's contests, or to the new
   * contest's own participants and pairing.
   *
   * One routine for both ways on, so a nameless contest is refused identically
   * whichever was pressed — and so going on can never mean going on without
   * having saved. `createDraft` returns the id, which is what makes the second
   * destination reachable at all.
   */
  async function save(then: 'list' | 'people') {
    setFormError(undefined);
    if (!name.trim()) {
      setNameError(t('newContest.nameRequired'));
      return;
    }
    setNameError(undefined);
    setSaving(then);
    try {
      const id = await createDraft(buildContent());
      // The panel names the contest a host is inside from the shared list, which
      // has never heard of this one. Without this the people open under a sidebar
      // calling their contest "This draft". Only on the way to the people: the
      // provider already refetches on arriving at the list, and refreshing here
      // too would fetch the same list twice.
      if (then === 'people') refreshContests();
      // The list, where it now shows as a draft — or straight to the people, which
      // is the next thing this form no longer asks for.
      navigate(then === 'people' ? `/review/${id}/people` : '/');
    } catch {
      setFormError(t('newContest.saveError'));
      setSaving(null);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Enter in a field saves and stops, exactly as it did before this form gained
    // a way onward. Going on is a deliberate press, not an accident of the keyboard.
    void save('list');
  }

  return (
    <main id="main">
      {/*
        The actions go to the panel's header. The Save button is outside the form
        in the DOM once portalled, so it names the form it belongs to — and it
        stays the submit, which keeps Enter meaning what it has always meant here.
      */}
      <PanelActions>
        <Link to="/" className={styles.cancel}>
          {t('newContest.cancel')}
        </Link>
        <Button type="submit" form={FORM_ID} variant="ghost" disabled={saving !== null}>
          {saving === 'list' ? t('newContest.saving') : t('newContest.saveDraft')}
        </Button>
        <Button onClick={() => void save('people')} disabled={saving !== null}>
          {saving === 'people' ? t('newContest.saving') : t('newContest.next')}
        </Button>
      </PanelActions>

      <div className={styles.heading}>
        <h1 className={styles.title}>{t('newContest.title')}</h1>
        <p className={styles.lead}>{t('newContest.lead')}</p>
      </div>

      <form id={FORM_ID} className={styles.form} onSubmit={onSubmit} noValidate>
        {formError ? (
          <div className={styles.wide}>
            <Callout tone="danger" role="alert">
              <p>{formError}</p>
            </Callout>
          </div>
        ) : null}

        <div className={styles.wide}>
          <Card>
            <FormField
              id="contest-name"
              label={t('newContest.contestName')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={nameError}
            />
          </Card>
        </div>

        <Card>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('newContest.formatLegend')}</legend>
            <div className={styles.choices}>
              {FORMATS.map((option) => (
                <Choice
                  key={option.value}
                  name="format"
                  value={option.value}
                  checked={format === option.value}
                  onChoose={() => setFormat(option.value)}
                  help={t(`newContest.${option.key}Help`)}
                >
                  {t(`newContest.${option.key}`)}
                </Choice>
              ))}
            </div>
          </fieldset>
        </Card>

        <Card>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('newContest.scoringLegend')}</legend>
            <p className={styles.groupHint}>{t('newContest.scoringHint')}</p>

            {/*
              Chips, as the design draws them. A label is a word or two, so adding
              and removing covers it — there is no editing in place, and a typo is
              fixed by taking the chip off and typing it again.
            */}
            <ul className={styles.chips} aria-label={t('newContest.categoriesLabel')}>
              {categories.map((category) => (
                <li key={category.id} className={styles.chip}>
                  {category.value}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={t('newContest.removeNamedCategory', { name: category.value })}
                    onClick={() =>
                      setCategories((rows) => rows.filter((r) => r.id !== category.id))
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
                aria-label={t('newContest.newCategoryLabel')}
                value={categoryDraft}
                onChange={(e) => setCategoryDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    // Enter adds the category rather than submitting the whole form,
                    // which is what a host in the middle of listing them expects.
                    e.preventDefault();
                    addCategory();
                  }
                }}
              />
              <Button variant="ghost" onClick={addCategory}>
                {t('newContest.addCategory')}
              </Button>
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('newContest.rangeLegend')}</legend>
            <div className={styles.sideBySide}>
              <Choice
                name="range"
                value="auto"
                checked={rangeType === 'auto'}
                onChoose={() => setRangeType('auto')}
              >
                {t('newContest.rangeAuto')}
              </Choice>
              <Choice
                name="range"
                value="fixed"
                checked={rangeType === 'fixed'}
                onChoose={() => setRangeType('fixed')}
              >
                {t('newContest.rangeFixed')}
              </Choice>
            </div>
            {/* Only asked for when it applies: a band being worked out has no ends. */}
            {rangeType === 'fixed' ? (
              <div className={styles.inline}>
                <FormField
                  id="range-min"
                  type="number"
                  label={t('newContest.rangeMin')}
                  value={rangeMin}
                  onChange={(e) => setRangeMin(e.target.value)}
                />
                <FormField
                  id="range-max"
                  type="number"
                  label={t('newContest.rangeMax')}
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
            {t('newContest.uniquePerCategory')}
          </label>
        </Card>

      </form>
    </main>
  );
}

/**
 * One choice, drawn as the design's card but still a real radio underneath — the
 * looks are a label's business and the semantics are the input's.
 *
 * The radio stays visible. The mockup draws the score range as a segmented pair
 * with no visible control, which means hiding the input — and an input hidden with
 * `opacity: 0`, or clipped to a pixel, is one that only a mouse aiming at its label
 * can reach. The browser suite refused to operate it, which is a fair proxy for
 * anything else driving the control directly. A visible radio is the honest thing
 * for a choice of one from two, and the card around it carries the design's weight.
 */
function Choice({
  name,
  value,
  checked,
  onChoose,
  help,
  children,
}: {
  readonly name: string;
  readonly value: string;
  readonly checked: boolean;
  readonly onChoose: () => void;
  readonly help?: string;
  readonly children: ReactNode;
}) {
  const labelId = `${name}-${value}-label`;
  const helpId = help ? `${name}-${value}-help` : undefined;
  return (
    // Named by the short label and *described* by the help, rather than labelled
    // by the whole card: the wrapping label would otherwise make the accessible
    // name the label and the explanation run together, so a screen reader would
    // read a sentence where a choice's name belongs.
    <label className={`${styles.choiceCard} ${checked ? styles.chosen : ''}`}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChoose}
        aria-labelledby={labelId}
        aria-describedby={helpId}
      />
      <span id={labelId} className={styles.choiceLabel}>
        {children}
      </span>
      {help ? (
        <span id={helpId} className={styles.choiceHelp}>
          {help}
        </span>
      ) : null}
    </label>
  );
}
