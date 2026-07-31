import { useTranslation } from 'react-i18next';
import { Hourglass } from '@phosphor-icons/react/dist/ssr';
import type { Turnout } from './api/client';
import styles from './waiting.module.css';

/**
 * Waiting for the reveal (screen 11) — where a participant spends longest.
 *
 * The screen is built to be complete WITHOUT the turnout and better with it.
 * The hourglass, the line about the host, and the ways onward at the foot are
 * the whole answer on their own; how the voting stands is an addition. That
 * ordering is not incidental: this read is new, it is polled, and the one thing
 * a waiting screen must never do is fail to say that it is waiting.
 *
 * Who has still to vote is said in words as well as in colour. A muted row is
 * not a state anyone can read, and this is the screen most likely to be looked
 * at across a table in bad light.
 */
export function Waiting({ turnout }: { turnout?: Turnout }) {
  const { t } = useTranslation();

  return (
    <div className={styles.waiting}>
      <span className={styles.glass} aria-hidden="true">
        <Hourglass size={40} weight="duotone" />
      </span>
      <h1 className={styles.title}>{t('reveal.waitingLead')}</h1>
      <p className={styles.note}>{t('reveal.waitingNote')}</p>

      {turnout && (
        <>
          {/*
            * Announced when it changes, and only this line: a live region around
            * the roster would recite every name each time one vote lands.
            */}
          <p className={styles.count} role="status">
            {t('reveal.votesIn', { in: turnout.votesIn, expected: turnout.votesExpected })}
          </p>
          <ul className={styles.roster} aria-label={t('reveal.whoIsIn')}>
            {turnout.participants.map((participant) => (
              <li
                key={participant.participantId}
                className={participant.sent ? styles.row : `${styles.row} ${styles.rowWaiting}`}
              >
                <span className={styles.name}>{participant.displayName}</span>
                <span className={participant.sent ? styles.tagIn : styles.tagWaiting}>
                  {participant.sent ? t('reveal.voteIn') : t('reveal.stillVoting')}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
