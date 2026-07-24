import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const ATTRIBUTION: readonly { value: Attribution; label: string }[] = [
  { value: 'per_person', label: 'Each person is scored on their own' },
  { value: 'per_couple', label: 'Each couple is scored together' },
];

const ANTI_BIAS: readonly { value: AntiBias; label: string }[] = [
  { value: 'none', label: 'No restriction' },
  { value: 'couples', label: 'Couples cannot score each other' },
  { value: 'arbitrary_pairs', label: 'Chosen pairs cannot score each other' },
];

/**
 * The manual "create a contest" form (design.md §8, form path). It captures the
 * rule space — name, attribution, anti-bias, scoring, participants — and saves a
 * draft; publishing it live is a later step. Only a name is required to save; the
 * rest is refined over time and fully checked at publish. Couple pairing and
 * per-pair exclusions are handled in draft review, not here.
 */
export function NewContest() {
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
      setNameError('A name is required to save this contest.');
      return;
    }
    setNameError(undefined);
    setSubmitting(true);
    try {
      await createDraft(buildContent());
      navigate('/'); // back to the contest list, where it now shows as a draft
    } catch {
      setFormError('Your contest couldn’t be saved. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <main id="main" className={styles.page}>
      <div className={styles.bar}>
        <div className={styles.brand}>
          <span className={styles.dot} aria-hidden="true" />
          <b>Tapas</b>
        </div>
      </div>

      <h1 className={styles.title}>New contest</h1>
      <p className={styles.lead}>
        Set it up now and save it as a draft — it won’t go live until you publish it.
      </p>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {formError ? (
          <div className={styles.alert} role="alert">
            <span aria-hidden="true">✕</span>
            <span>{formError}</span>
          </div>
        ) : null}

        <FormField
          id="contest-name"
          label="Contest name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
        />

        <fieldset className={styles.group}>
          <legend className={styles.legend}>How dishes are attributed</legend>
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
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Guarding against bias</legend>
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
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Scoring</legend>
          <p className={styles.groupHint}>What each dish is judged on, and the score band.</p>

          <ul className={styles.rows} aria-label="Scoring categories">
            {categories.map((category, index) => (
              <li key={category.id} className={styles.row}>
                <input
                  aria-label={`Category ${index + 1} name`}
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
                  aria-label={`Remove category ${index + 1}`}
                  onClick={() => setCategories((rows) => rows.filter((r) => r.id !== category.id))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className={styles.add} onClick={() => setCategories((r) => [...r, makeRow()])}>
            Add category
          </button>

          <fieldset className={styles.group} style={{ marginTop: 20 }}>
            <legend className={styles.legend}>Score range</legend>
            <div className={styles.choices}>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name="range"
                  checked={rangeType === 'auto'}
                  onChange={() => setRangeType('auto')}
                />
                Set it automatically
              </label>
              <label className={styles.choice}>
                <input
                  type="radio"
                  name="range"
                  checked={rangeType === 'fixed'}
                  onChange={() => setRangeType('fixed')}
                />
                Fixed range
              </label>
            </div>
            {rangeType === 'fixed' ? (
              <div className={styles.inline} style={{ marginTop: 12 }}>
                <div className={styles.numberField}>
                  <label htmlFor="range-min">Lowest score</label>
                  <input
                    id="range-min"
                    type="number"
                    value={rangeMin}
                    onChange={(e) => setRangeMin(e.target.value)}
                  />
                </div>
                <div className={styles.numberField}>
                  <label htmlFor="range-max">Highest score</label>
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
            A voter can’t give the same score twice in a category
          </label>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.legend}>Participants</legend>
          <p className={styles.groupHint}>Add who is taking part. You can pair couples later.</p>

          <div className={styles.row}>
            <input
              aria-label="New participant name"
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
              Add
            </button>
          </div>

          {participants.length === 0 ? (
            <p className={styles.empty}>No participants added yet.</p>
          ) : (
            <ul className={styles.rows} aria-label="Participants">
              {participants.map((participant, index) => (
                <li key={participant.id} className={styles.row}>
                  <input
                    aria-label={`Participant ${index + 1} name`}
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
                    aria-label={`Remove participant ${participant.value || index + 1}`}
                    onClick={() =>
                      setParticipants((rows) => rows.filter((r) => r.id !== participant.id))
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </fieldset>

        <div className={styles.actions}>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save as draft'}
          </Button>
          <Link to="/" className={styles.cancel}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
