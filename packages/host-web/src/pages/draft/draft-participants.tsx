import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Callout, Card } from '@tapas/ui';
import { useDraftEditor, type EditPerson } from './draft-editor';
import styles from './draft-participants.module.css';

/**
 * Who is taking part in a contest being prepared, who they are paired with, and
 * which pairs may not score each other.
 *
 * Barring sits beside the roster rather than off in the aside, because it is work
 * done on these same people: the names being barred and the names being paired are
 * read in one place.
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
        aside={t('reviewDraft.peopleAndCouples', {
          people: editor.people.length,
          couples: editor.couples,
        })}
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
              const needsPartner = editor.attribution === 'per_couple' && !person.partnerId;
              return (
                <li key={person.id} className={styles.personRow}>
                  <input
                    className={styles.input}
                    aria-label={t('reviewDraft.participantName', { number: index + 1 })}
                    value={person.displayName}
                    onChange={(e) => editor.renamePerson(person.id, e.target.value)}
                  />
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

      <Card title={t('reviewDraft.barredTitle')} level={3}>
        <p className={styles.cardHint}>{t('reviewDraft.barredHint')}</p>
        {/*
          A contest guards against bias one way, not several — the compiler reads
          these pairs only when the rule is "chosen pairs cannot score each other"
          (`compile.ts`, where the no-score map is built under that rule alone).
          Under any other rule a host could bar a pair, watch it appear in the list,
          save it, publish, and have it do nothing, with the screen saying nothing.

          Said rather than hidden, and the pairs stay editable: they are kept in the
          draft either way, so choosing the other rule puts them in force without
          anybody having to enter them again.
        */}
        {editor.antiBias !== 'arbitrary_pairs' ? (
          <div className={styles.notInForce}>
            <Callout tone="saffron" title={t('reviewDraft.barredNotInForceTitle')}>
              <p>{t('reviewDraft.barredNotInForceBody')}</p>
            </Callout>
          </div>
        ) : null}
        {editor.barredPairs.length === 0 ? (
          <p className={styles.empty}>{t('reviewDraft.noBarredPairs')}</p>
        ) : (
          <ul className={styles.pairs} aria-label={t('reviewDraft.barredTitle')}>
            {editor.barredPairs.map(({ one, other }) => {
              const oneName = editor.nameOf(one);
              const otherName = editor.nameOf(other);
              return (
                <li key={`${one.id}~${other.id}`} className={styles.pair}>
                  <span>
                    {oneName} <span aria-hidden="true">↔</span> {otherName}
                  </span>
                  <button
                    type="button"
                    className={styles.chipRemove}
                    aria-label={t('reviewDraft.liftBar', { one: oneName, other: otherName })}
                    onClick={() => editor.liftPair(one.id, other.id)}
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {editor.people.length >= 2 ? (
          <AddPair people={editor.people} nameOf={editor.nameOf} onBar={editor.barPair} />
        ) : null}
      </Card>
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
  readonly nameOf: (person: EditPerson) => string;
  readonly onBar: (oneId: string, otherId: string) => void;
}) {
  const { t } = useTranslation();
  const [one, setOne] = useState('');
  const [other, setOther] = useState('');

  const options = people.map((person) => ({ id: person.id, name: nameOf(person) }));

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
