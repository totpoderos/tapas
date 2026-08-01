import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card } from '@tapas/ui';
import { useDraftEditor } from './draft-editor';
import styles from './draft-participants.module.css';

/**
 * Who is taking part in a contest being prepared, and who they are paired with.
 *
 * A partner is asked for only where it does something: the contest's format decides
 * whether pairing appears at all, so this section never offers a control that would
 * change nothing.
 */
export function DraftParticipants() {
  const { t } = useTranslation();
  const editor = useDraftEditor();
  const [personDraft, setPersonDraft] = useState('');

  function addPerson() {
    editor.addPerson(personDraft);
    setPersonDraft('');
  }

  return (
    <>
      <div className={styles.sectionHeading}>
        <h2 className={styles.sectionTitle}>{t('reviewDraft.participantsTitle')}</h2>
        <p className={styles.sectionLead}>{t('reviewDraft.participantsLead')}</p>
      </div>

      <Card
        title={t('reviewDraft.participants')}
        /* Couples are counted only where they mean something: under a format
           that pairs nobody, "0 couples" is a fact about a rule the contest
           does not have. */
        aside={
          editor.partnersMatter
            ? t('reviewDraft.peopleAndCouples', {
                people: editor.people.length,
                couples: editor.couples,
              })
            : t('reviewDraft.peopleOnly', { count: editor.people.length })
        }
        level={3}
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

        {editor.people.length === 0 ? (
          <p className={styles.empty}>{t('reviewDraft.emptyParticipants')}</p>
        ) : (
          <ul className={styles.people} aria-label={t('reviewDraft.participants')}>
            {editor.people.map((person, index) => {
              const others = editor.people.filter((p) => p.id !== person.id);
              const needsPartner = editor.format === 'couples' && !person.partnerId;
              return (
                <li key={person.id} className={styles.personRow}>
                  <input
                    className={styles.input}
                    aria-label={t('reviewDraft.participantName', { number: index + 1 })}
                    value={person.displayName}
                    onChange={(e) => editor.renamePerson(person.id, e.target.value)}
                  />
                  {editor.partnersMatter ? (
                  <label className={styles.partner}>
                    <span className={styles.partnerLabel}>{t('reviewDraft.partnerLabel')}</span>
                    <select
                      className={`${styles.select} ${needsPartner ? styles.wanting : ''}`}
                      aria-label={t('reviewDraft.partnerOf', { name: editor.nameOf(person) })}
                      aria-describedby={needsPartner ? `${person.id}-wanting` : undefined}
                      value={person.partnerId ?? ''}
                      onChange={(e) => editor.setPartner(person.id, e.target.value || null)}
                    >
                      <option value="">{t('reviewDraft.partnerNone')}</option>
                      {others.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.displayName || t('reviewDraft.unnamed')}
                        </option>
                      ))}
                    </select>
                  </label>
                  ) : null}
                  {/* Said in words, not only by a red edge. */}
                  {needsPartner ? (
                    <span id={`${person.id}-wanting`} className={styles.wantingNote}>
                      {t('reviewDraft.needsPartner')}
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    aria-label={t('reviewDraft.removePerson', { name: editor.nameOf(person) })}
                    onClick={() => editor.removePerson(person.id)}
                  >
                    {t('reviewDraft.remove')}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

    </>
  );
}
