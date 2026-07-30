import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button, Callout, Card, FormField } from '@tapas/ui';
import {
  createDraft,
  type Attribution,
  type AntiBias,
  type DraftContent,
  type ScoreRange,
} from '../api/client';
import { PanelActions } from '../shell/panel-actions';
import styles from './new-contest.module.css';

interface Row {
  readonly id: string;
  readonly value: string;
}

/** A stable id so the header's Save button can name the form it submits. */
const FORM_ID = 'new-contest-form';

const ATTRIBUTION: readonly { value: Attribution; labelKey: string }[] = [
  { value: 'per_person', labelKey: 'attributionPerPerson' },
  { value: 'per_couple', labelKey: 'attributionPerCouple' },
];

const ANTI_BIAS: readonly { value: AntiBias; labelKey: string }[] = [
  { value: 'none', labelKey: 'antiBiasNone' },
  { value: 'couples', labelKey: 'antiBiasCouples' },
  { value: 'arbitrary_pairs', labelKey: 'antiBiasArbitrary' },
];

/**
 * The manual "create a contest" form (design.md §8, form path). It captures the
 * rule space — name, attribution, anti-bias, scoring, participants — and saves a
 * draft; publishing it live is a later step. Only a name is required to save; the
 * rest is refined over time and fully checked at publish. Couple pairing and
 * per-pair exclusions are handled in draft review, not here.
 *
 * No chrome of its own: the panel says where this is, and Save and Cancel go in the
 * panel's header where the actions for a whole surface belong.
 */
export function NewContest() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const nextId = useRef(0);
  const makeRow = (value = ''): Row => ({ id: `r${nextId.current++}`, value });

  const [name, setName] = useState('');
  const [attribution, setAttribution] = useState<Attribution>('per_person');
  const [antiBias, setAntiBias] = useState<AntiBias>('none');
  const [categories, setCategories] = useState<Row[]>([makeRow('Taste')]);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [rangeType, setRangeType] = useState<'auto' | 'fixed'>('auto');
  const [rangeMin, setRangeMin] = useState('1');
  const [rangeMax, setRangeMax] = useState('10');
  const [uniquePerCategory, setUniquePerCategory] = useState(true);
  const [participants, setParticipants] = useState<Row[]>([]);
  const [participantDraft, setParticipantDraft] = useState('');

  const [nameError, setNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  function addParticipant() {
    const value = participantDraft.trim();
    if (!value) return;
    setParticipants((rows) => [...rows, makeRow(value)]);
    setParticipantDraft('');
  }

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
      attribution,
      antiBias,
      scoring: {
        categories: categories
          .map((c) => c.value.trim())
          .filter(Boolean)
          .map((label, i) => ({ id: `c${i + 1}`, name: label })),
        range,
        uniquePerCategory,
      },
      participants: participants.map((p, i) => ({ id: `p${i + 1}`, displayName: p.value })),
    };
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(undefined);
    if (!name.trim()) {
      setNameError(t('newContest.nameRequired'));
      return;
    }
    setNameError(undefined);
    setSubmitting(true);
    try {
      await createDraft(buildContent());
      navigate('/'); // back to the contest list, where it now shows as a draft
    } catch {
      setFormError(t('newContest.saveError'));
      setSubmitting(false);
    }
  }

  return (
    <main id="main">
      {/*
        Save and Cancel go to the panel's header. The Save button is outside the
        form in the DOM once portalled, so it names the form it belongs to.
      */}
      <PanelActions>
        <Link to="/" className={styles.cancel}>
          {t('newContest.cancel')}
        </Link>
        <Button type="submit" form={FORM_ID} disabled={submitting}>
          {submitting ? t('newContest.saving') : t('newContest.saveDraft')}
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
            <legend className={styles.legend}>{t('newContest.attributionLegend')}</legend>
            <div className={styles.choices}>
              {ATTRIBUTION.map((option) => (
                <Choice
                  key={option.value}
                  name="attribution"
                  value={option.value}
                  checked={attribution === option.value}
                  onChoose={() => setAttribution(option.value)}
                >
                  {t(`newContest.${option.labelKey}`)}
                </Choice>
              ))}
            </div>
          </fieldset>

          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('newContest.antiBiasLegend')}</legend>
            <div className={styles.choices}>
              {ANTI_BIAS.map((option) => (
                <Choice
                  key={option.value}
                  name="anti-bias"
                  value={option.value}
                  checked={antiBias === option.value}
                  onChoose={() => setAntiBias(option.value)}
                >
                  {t(`newContest.${option.labelKey}`)}
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

        <div className={styles.wide}>
          <Card>
            <fieldset className={styles.group}>
              <legend className={styles.legend}>{t('newContest.participantsLegend')}</legend>
              <p className={styles.groupHint}>{t('newContest.participantsHint')}</p>

              <div className={styles.addRow}>
                <input
                  className={styles.input}
                  aria-label={t('newContest.newParticipantLabel')}
                  value={participantDraft}
                  onChange={(e) => setParticipantDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addParticipant();
                    }
                  }}
                />
                <Button variant="ghost" onClick={addParticipant}>
                  {t('newContest.add')}
                </Button>
              </div>

              {participants.length === 0 ? (
                <p className={styles.empty}>{t('newContest.participantsEmpty')}</p>
              ) : (
                /* Editable rows, unlike the categories above: the design does not
                   show participants on this screen, draft review keeps their names
                   editable, and a person's name is longer and easier to mistype. */
                <ul className={styles.rows} aria-label={t('newContest.participantsLabel')}>
                  {participants.map((participant, index) => (
                    <li key={participant.id} className={styles.row}>
                      <input
                        className={styles.input}
                        aria-label={t('newContest.participantNameLabel', { n: index + 1 })}
                        value={participant.value}
                        onChange={(e) =>
                          setParticipants((rows) =>
                            rows.map((r) =>
                              r.id === participant.id ? { ...r, value: e.target.value } : r,
                            ),
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        aria-label={t('newContest.removeParticipant', {
                          name: participant.value || index + 1,
                        })}
                        onClick={() =>
                          setParticipants((rows) => rows.filter((r) => r.id !== participant.id))
                        }
                      >
                        {t('newContest.remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          </Card>
        </div>
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
