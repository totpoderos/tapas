import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { CaretRight } from '@phosphor-icons/react/dist/ssr';
import styles from './score-track.module.css';

/**
 * One category's score for one dish.
 *
 * It replaces two rows of ten small radio buttons with a single control the
 * width of the screen — fifty targets on a five-dish ballot was the thing this
 * redesign exists to fix.
 *
 * **It is a radio group.** One input per allowed value, so arrow keys move a
 * step, the checked value is announced, and the value that can be saved is
 * always one of the allowed ones — not a number derived from a pixel. Home and
 * End are added because a native radio group has no notion of "the lowest" and a
 * ten-step range is otherwise nine presses wide.
 *
 * The drag is layered on top and owns nothing: pointer down anywhere picks the
 * nearest step, moving slides between steps, and releasing commits. Take the
 * pointer handling away and the control still works.
 */
export function ScoreTrack({
  categoryName,
  groupLabel,
  name,
  min,
  max,
  value,
  onChange,
}: {
  categoryName: string;
  /** What the group is called to a screen reader — "{dish} — {category}". */
  groupLabel: string;
  /** Unique per dish×category, so the radios form one group. */
  name: string;
  min: number;
  max: number;
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const { t } = useTranslation();
  const trackRef = useRef<HTMLDivElement>(null);
  /**
   * The value under the finger mid-drag. The saved value is untouched until
   * release.
   *
   * Held in a ref as well as in state, and the ref is what the handlers read.
   * A quick tap fires pointerdown and pointerup faster than React re-renders
   * between them, so a handler closing over the state value still sees the one
   * from before the press and commits nothing. The state exists only to redraw.
   */
  const dragRef = useRef<number | undefined>(undefined);
  /** Where the press began, for telling a tap from a drag. */
  const startRef = useRef<number | undefined>(undefined);
  const [dragging, setDragging] = useState<number | undefined>();

  function setDrag(value: number | undefined) {
    dragRef.current = value;
    setDragging(value);
  }

  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const shown = dragging ?? value;
  const scored = shown !== undefined;

  /*
   * Where the knob sits: the centre of the chosen step's slot, not the value's
   * share of the range. With ten steps the first is at 5% and the last at 95%,
   * which is what puts the knob over its own label rather than off the end.
   */
  const fraction = scored ? (shown - min + 0.5) / steps.length : 0;

  /** The step under a pointer at this client x — always one of the allowed values. */
  function stepAt(clientX: number): number {
    const box = trackRef.current?.getBoundingClientRect();
    if (!box) return min;
    const inner = box.width - 12; // the 6px padding either side
    const ratio = (clientX - box.left - 6) / (inner || 1);
    const index = Math.floor(ratio * steps.length);
    return steps[Math.min(steps.length - 1, Math.max(0, index))]!;
  }

  /*
   * A tap is left entirely to the platform: it lands on a step's own input and
   * checks it, the way any radio does. Only an actual drag is ours.
   *
   * The first attempt did the opposite — cancelled the default on pointerdown so
   * the gesture could be handled wholesale — and that quietly broke the native
   * path for everything that drives a radio properly, from Playwright's `check()`
   * to a screen reader's click. The control has to keep working as a radio group
   * first; sliding is an addition to it.
   */
  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    startRef.current = event.clientX;
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (startRef.current === undefined) return;
    // Below the threshold this is still a tap, and the tap belongs to the input.
    if (dragRef.current === undefined && Math.abs(event.clientX - startRef.current) < 6) return;
    if (dragRef.current === undefined) event.currentTarget.setPointerCapture(event.pointerId);
    setDrag(stepAt(event.clientX));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const dragged = dragRef.current !== undefined;
    startRef.current = undefined;
    if (!dragged) return; // a tap: the input has already handled it

    const settled = stepAt(event.clientX);
    setDrag(undefined);
    // A drag that ends over a different step than it began on produces no native
    // click — the two share only the track as an ancestor — so this commits it.
    trackRef.current?.querySelector<HTMLInputElement>(`input[value="${settled}"]`)?.focus();
    if (settled !== value) onChange(settled);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Home') {
      event.preventDefault();
      onChange(min);
    } else if (event.key === 'End') {
      event.preventDefault();
      onChange(max);
    }
  }

  return (
    <div className={`${styles.panel} ${scored ? '' : styles.panelUnscored}`}>
      <div className={styles.header}>
        {/*
          An h2, not the h4 the handoff names — that is a type size, not a
          heading rank. The dish is this screen's h1, so a category jumping to
          level 4 skips two levels and leaves anyone navigating by headings
          wondering what they missed.
        */}
        <h2 className={styles.category}>{categoryName}</h2>
        {scored ? (
          <span className={styles.value} aria-hidden="true">
            {shown}
          </span>
        ) : (
          /* The colour is never the only signal that a category still wants them. */
          <span className={styles.yourTurn}>{t('score.yourTurn')}</span>
        )}
      </div>

      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          startRef.current = undefined;
          setDrag(undefined);
        }}
        onKeyDown={onKeyDown}
      >
        {scored ? (
          <span
            className={styles.fill}
            style={{ width: `calc((100% - 12px) * ${fraction})` }}
            aria-hidden="true"
          />
        ) : null}
        {/*
          Clamped to the track. The knob is 60px wide inside a 64px track, so
          centring it on the first step's slot puts half of it outside the left
          edge — the handoff's formula assumes a knob narrower than its own
          parking space. Clamping keeps it whole at both ends without moving it
          anywhere else along the way.
        */}
        <span
          className={styles.knob}
          style={{
            left: `clamp(2px, calc(6px + (100% - 12px) * ${fraction} - 30px), calc(100% - 62px))`,
          }}
          aria-hidden="true"
        >
          {scored ? null : <CaretRight size={20} weight="duotone" />}
        </span>

        <div className={styles.steps} role="radiogroup" aria-label={groupLabel}>
          {steps.map((step, i) => {
            const chosen = shown === step;
            const under = scored && step < shown;
            return (
              <label
                key={step}
                className={[
                  styles.step,
                  under ? styles.stepUnder : '',
                  chosen ? styles.stepChosen : '',
                  i === 0 ? styles.stepFirst : '',
                  i === steps.length - 1 ? styles.stepLast : '',
                  /*
                   * Above about a dozen steps there is no room to label each one
                   * at phone width. `range` is host-configurable with no upper
                   * bound worth trusting, so this is a property of the data, not
                   * of the screen — the narrow-screen case is handled in CSS.
                   */
                  steps.length > 12 && i !== 0 && i !== steps.length - 1
                    ? styles.stepLabelHidden
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {/*
                  The name is on the input, not taken from the visible number.
                  The number is hidden when the range is too wide to label every
                  step, and `visibility: hidden` takes it out of the
                  accessibility tree as well as off the screen — which would
                  leave the radio nameless exactly when the range is largest.
                */}
                <input
                  className={styles.input}
                  type="radio"
                  name={name}
                  value={step}
                  aria-label={String(step)}
                  checked={value === step}
                  onChange={() => onChange(step)}
                />
                <span aria-hidden="true">{step}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
