import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, FormField } from '@tapas/ui';
import type { AntiBias, Attribution } from '../../api/client';
import { useDraftEditor } from './draft-editor';
import styles from './draft-rules.module.css';

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
 * The rules of a contest being prepared: what it is called, how its dishes are
 * attributed, what guards against bias, and what it is scored on.
 *
 * Fields only. The draft itself, the saving and the publishing belong to the
 * workspace above, which is what lets a host change something here, go to the
 * people, and save both together.
 */
export function DraftRules() {
  const { t } = useTranslation();
  const editor = useDraftEditor();
  const [categoryDraft, setCategoryDraft] = useState('');

  function addCategory() {
    editor.addCategory(categoryDraft);
    setCategoryDraft('');
  }

  return (
    <>
      <div className={styles.sectionHeading}>
        <h2 className={styles.sectionTitle}>{t('reviewDraft.rulesTitle')}</h2>
        <p className={styles.sectionLead}>{t('reviewDraft.rulesLead')}</p>
      </div>

      <Card>
        <FormField
          id="draft-name"
          label={t('reviewDraft.nameLabel')}
          value={editor.name}
          onChange={(e) => editor.setName(e.target.value)}
          error={editor.nameError}
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
                checked={editor.attribution === option.value}
                onChoose={() => editor.setAttribution(option.value)}
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
                checked={editor.antiBias === option.value}
                onChoose={() => editor.setAntiBias(option.value)}
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
            {editor.categories.map((category) => (
              <li key={category.key} className={styles.chip}>
                {category.name}
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={t('reviewDraft.removeCategory', { name: category.name })}
                  onClick={() => editor.removeCategory(category.key)}
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
              checked={editor.rangeType === 'auto'}
              onChoose={() => editor.setRangeType('auto')}
            >
              {t('reviewDraft.rangeAuto')}
            </Choice>
            <Choice
              name="range"
              value="fixed"
              checked={editor.rangeType === 'fixed'}
              onChoose={() => editor.setRangeType('fixed')}
            >
              {t('reviewDraft.rangeFixed')}
            </Choice>
          </div>
          {editor.rangeType === 'fixed' ? (
            <div className={styles.inline}>
              <FormField
                id="range-min"
                type="number"
                label={t('reviewDraft.rangeMin')}
                value={editor.rangeMin}
                onChange={(e) => editor.setRangeMin(e.target.value)}
              />
              <FormField
                id="range-max"
                type="number"
                label={t('reviewDraft.rangeMax')}
                value={editor.rangeMax}
                onChange={(e) => editor.setRangeMax(e.target.value)}
              />
            </div>
          ) : null}
        </fieldset>

        <label className={styles.check}>
          <input
            type="checkbox"
            checked={editor.uniquePerCategory}
            onChange={(e) => editor.setUniquePerCategory(e.target.checked)}
          />
          {t('reviewDraft.uniquePerCategory')}
        </label>
      </Card>
    </>
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
