import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { CheckCircle, ForkKnife, SlidersHorizontal, Trophy } from '@phosphor-icons/react/dist/ssr';
import styles from './bottom-bar.module.css';

/** The steps a joined participant can be on. */
export type Step = 'dish' | 'score' | 'reveal';

/**
 * How this participant's own vote stands — and only their own. Nothing here
 * says anything about anybody else's; that is the reveal's waiting screen, and
 * it is a different read behind a different permission.
 */
export type VoteStanding = 'none' | 'outstanding' | 'sent';

/**
 * The dish form has no address of its own — it is the `joined` step of the join
 * route, which recognises the device and lands there.
 */
const PATH: Record<Step, string> = { dish: '/', score: '/score', reveal: '/reveal' };

/**
 * FULL key paths, with English defaults. The apps nest each locale file under its
 * own key, so a bare `bar.dish` resolves to nothing and i18next answers by
 * echoing the key — which lands in the label and in the link's accessible name.
 * That has shipped here before (`LanguageSelect` announcing "language.label").
 *
 * The labels are one word each. They were "The dishes", "Your scores" and "The
 * results" when they were links at the foot of a page and had a line to
 * themselves; under a 26px icon in a third of a phone's width they are not.
 */
const LABEL: Record<Step, readonly [string, string]> = {
  dish: ['common.bar.dish', 'Dishes'],
  score: ['common.bar.score', 'Score'],
  reveal: ['common.bar.reveal', 'Results'],
};

const ICON: Record<Step, typeof ForkKnife> = {
  dish: ForkKnife,
  score: SlidersHorizontal,
  reveal: Trophy,
};

const ORDER: readonly Step[] = ['dish', 'score', 'reveal'];

/**
 * The ways onward, as a bar held at the foot of the screen.
 *
 * They were quiet links under a rule at the bottom of the page. A cook is
 * standing up, one-handed, holding a plate, and a page longer than the phone
 * put those links below the fold — which is the same defect as not having them,
 * arrived at by scrolling instead of by forgetting. So they are fixed, they are
 * in the thumb arc, and they cannot scroll away.
 *
 * All three steps are always offered, including the one you are on. That is the
 * change from the links, which showed only the other two: a bar whose contents
 * shift as you move is a bar you have to re-read every time, and "you are here"
 * is worth saying out loud. It is said three ways — the accent colour, a rule
 * under the current step, and `aria-current` — because the spec forbids colour
 * as the only carrier and colour is the first thing a phone in bad light loses.
 *
 * One component deciding this, rather than each screen knowing about one
 * specific next screen, is still the point: `/score` and `/reveal` carried no
 * links at all once, so a participant who arrived by the back button or a reload
 * was stranded with only the browser's own controls.
 */
export function BottomBar({
  current,
  standing = 'none',
}: {
  current: Step;
  standing?: VoteStanding;
}) {
  const { t } = useTranslation();

  return (
    <nav className={styles.bar} aria-label={t('common.bar.label', 'Go to')}>
      <div className={styles.steps}>
        {ORDER.map((step) => {
          const Icon = ICON[step];
          const here = step === current;
          const label = t(LABEL[step][0], LABEL[step][1]);
          return (
            <Link
              key={step}
              to={PATH[step]}
              className={here ? `${styles.step} ${styles.stepHere}` : styles.step}
              // The one non-visual mark, and the only one a screen reader has.
              aria-current={here ? 'page' : undefined}
              aria-label={step === 'score' ? nameWithStanding(t, label, standing) : undefined}
            >
              <span className={styles.mark}>
                <Icon size={26} weight="duotone" aria-hidden="true" />
                {step === 'score' && <BadgeGlyph standing={standing} />}
              </span>
              <span className={styles.label}>{label}</span>
              {/*
                The rule under the current step. Drawn on every step so the row
                does not shift by 3px as you move between them, and coloured only
                on the current one.
              */}
              <span className={styles.rule} aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * How the participant's own vote stands, on the scoring step — drawn.
 *
 * This is how somebody learns that scoring has opened while they are looking at
 * the dishes: without a banner to read, on a screen they may not be on. Which
 * means it has to survive the room it is read in, so the two states are
 * different SHAPES — a filled dot, a tick — and not two colours. `BadgeWords`
 * below carries the same two states for anyone who can see neither.
 */
function BadgeGlyph({ standing }: { standing: VoteStanding }) {
  if (standing === 'none') return null;
  return standing === 'sent' ? (
    <CheckCircle size={14} weight="duotone" className={styles.tick} aria-hidden="true" />
  ) : (
    <span className={styles.dot} aria-hidden="true" />
  );
}

/**
 * The same standing, in words, for anyone reading by ear.
 *
 * An `aria-label` rather than text hidden inside the link, and that is the
 * second attempt: an accessible name is assembled from its parts with no
 * separator between inline ones, and each part is trimmed before it is joined —
 * so hidden text next to the label produced the name "Scorestill to send", in
 * every engine, whatever whitespace was written into it.
 *
 * The name still OPENS with the visible label, so it is a superset of what is
 * written on the step rather than a replacement for it — voice control saying
 * "click Score" keeps working (WCAG 2.5.3), which is the thing an `aria-label`
 * usually breaks.
 *
 * Returns undefined where there is nothing to say, leaving the name to come
 * from the label as it does on the other two steps.
 */
function nameWithStanding(
  t: (key: string, fallback: string, vars?: Record<string, string>) => string,
  label: string,
  standing: VoteStanding,
): string | undefined {
  if (standing === 'none') return undefined;
  const said =
    standing === 'sent'
      ? t('common.bar.voteSent', 'already sent')
      : t('common.bar.stillToSend', 'still to send');
  return t('common.bar.withStanding', '{{step}} {{standing}}', { step: label, standing: said });
}
