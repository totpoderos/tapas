import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { Button, FormField } from '@tapas/ui';
import {
  createDraft,
  type Attribution,
  type AntiBias,
  type DraftContent,
  type ScoreRange,
} from '../api/client';
import styles from './new-contest.module.css';

interface Row {
  readonly id: string;
  readonly value: string;
}

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
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>{t('common.brand')}</b>
        </div>
      </div>

      <h1 className={styles.title}>{t('newContest.title')}</h1>
      <p className={styles.lead}>{t('newContest.lead')}</p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {formError ? (
          <div className={styles.alert} role="alert">
            <span aria-hidden="true">✕</span>
            <span>{formError}</span>
          </div>
        ) : null}

        <FormField
          id="contest-name"
          label={t('newContest.contestName')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('newContest.attributionLegend')}</legend>
          <div className={styles.choices}>
            {ATTRIBUTION.map((option) => (
              <label key={option.value} className={styles.choice}>
                <input
                  type="radio"
                  name="attribution"
                  value={option.value}
                  checked={attribution === option.value}
                  onChange={() => setAttribution(option.value)}
                />
                {t(`newContest.${option.labelKey}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('newContest.antiBiasLegend')}</legend>
          <div className={styles.choices}>
            {ANTI_BIAS.map((option) => (
              <label key={option.value} className={styles.choice}>
                <input
                  type="radio"
                  name="anti-bias"
                  value={option.value}
                  checked={antiBias === option.value}
                  onChange={() => setAntiBias(option.value)}
                />
                {t(`newContest.${option.labelKey}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('newContest.scoringLegend')}</legend>
          <p className={styles.groupHint}>{t('newContest.scoringHint')}</p>

          <ul className={styles.rows} aria-label={t('newContest.categoriesLabel')}>
            {categories.map((category, index) => (
              <li key={category.id} className={styles.row}>
                <input
                  aria-label={t('newContest.categoryNameLabel', { n: index + 1 })}
                  value={category.value}
                  onChange={(e) =>
                    setCategories((rows) =>
                      rows.map((r) => (r.id === category.id ? { ...r, value: e.target.value } : r)),
                    )
                  }
                />
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={t('newContest.removeCategory', { n: index + 1 })}
                  onClick={() => setCategories((rows) => rows.filter((r) => r.id !== category.id))}
                >
                  {t('newContest.remove')}
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.add} onClick={() => setCategories((r) => [...r, makeRow()])}>
            {t('newContest.addCategory')}
          </button>

          <fieldset className={styles.group} style={{ marginTop: 20 }}>
            <legend className={styles.legend}>{t('newContest.rangeLegend')}</legend>
            <div className={styles.choices}>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name="range"
                  checked={rangeType === 'auto'}
                  onChange={() => setRangeType('auto')}
                />
                {t('newContest.rangeAuto')}
              </label>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name="range"
                  checked={rangeType === 'fixed'}
                  onChange={() => setRangeType('fixed')}
                />
                {t('newContest.rangeFixed')}
              </label>
            </div>
            {rangeType === 'fixed' ? (
              <div className={styles.inline} style={{ marginTop: 12 }}>
                <div className={styles.numberField}>
                  <label htmlFor="range-min">{t('newContest.rangeMin')}</label>
                  <input
                    id="range-min"
                    type="number"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                  />
                </div>
                <div className={styles.numberField}>
                  <label htmlFor="range-max">{t('newContest.rangeMax')}</label>
                  <input
                    id="range-max"
                    type="number"
                    value={rangeMax}
                    onChange={(e) => setRangeMax(e.target.value)}
                  />
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
            {t('newContest.uniquePerCategory')}
          </label>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>{t('newContest.participantsLegend')}</legend>
          <p className={styles.groupHint}>{t('newContest.participantsHint')}</p>

          <div className={styles.row}>
            <input
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
            <button type="button" className={styles.remove} onClick={addParticipant}>
              {t('newContest.add')}
            </button>
          </div>

          {participants.length === 0 ? (
            <p className={styles.empty}>{t('newContest.participantsEmpty')}</p>
          ) : (
            <ul className={styles.rows} aria-label={t('newContest.participantsLabel')}>
              {participants.map((participant, index) => (
                <li key={participant.id} className={styles.row}>
                  <input
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
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={t('newContest.removeParticipant', {
                      name: participant.value || index + 1,
                    })}
                    onClick={() =>
                      setParticipants((rows) => rows.filter((r) => r.id !== participant.id))
                    }
                  >
                    {t('newContest.remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div className={styles.actions}>
          <Button type="submit" disabled={submitting}>
            {submitting ? t('newContest.saving') : t('newContest.saveDraft')}
          </Button>
          <Link to="/" className={styles.cancel}>
            {t('newContest.cancel')}
          </Link>
        </div>
      </form>
    </main>
  );
}
