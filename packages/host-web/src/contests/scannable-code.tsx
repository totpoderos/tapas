import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import qr from 'qrcode-generator';
import styles from './scannable-code.module.css';

/** A quiet border around the code, in modules. Scanners need it to find the edges. */
const QUIET_MODULES = 2;

export interface ScannableCodeProps {
  /**
   * What the code carries: the link that joins the contest. Handed in rather than
   * built here, so this never learns the participant app's address or its route.
   */
  readonly value: string;
  /** The join code the link carries — what this is called, not what it encodes. */
  readonly code: string;
}

/**
 * A contest's join link as something a phone can point at.
 *
 * The SVG is built from the module grid rather than taken from the library's
 * `createSvgTag()`, so the sizing, the quiet border and the accessible name are
 * this component's to decide.
 *
 * It stays dark-on-light in both themes, which is the one place in this app that
 * ignores them. Following the theme inverts the code in the dark one, and the QR
 * standard assumes dark modules on a light ground — some scanners cope with an
 * inverted code and plenty do not. A host holding up something half the room
 * cannot scan is worse than a plate that does not match the panel around it. See
 * the stylesheet.
 *
 * What it encodes and what it is called are two arguments, deliberately. It
 * encodes the join link, so a scan lands on the joining screen with the code
 * already entered; it is *named* by the join code, because a screen-reader user
 * is being handed a code, and an address read out character by character is no
 * use to anybody. Neither is derived from the other, so this never parses a URL.
 *
 * The link carries the participant app's address and the join code, and nothing
 * else — a join code is meant to be handed to strangers, and anything else about
 * the contest is not. The code stays printed beside this and copying stays on
 * offer, because a scan can fail, a phone may have no camera, and somebody may be
 * joining from a laptop across the table.
 */
export function ScannableCode({ value, code }: ScannableCodeProps) {
  const { t } = useTranslation();

  const grid = useMemo(() => {
    // Version 0 lets the library pick the smallest that fits; 'M' is the usual
    // middle error-correction level, which tolerates a smudged print. A link needs
    // more modules than a bare code did — a venue print gets thumbed and smudged,
    // so the correction level is not what we spend to get them back.
    const symbol = qr(0, 'M');
    symbol.addData(value);
    symbol.make();

    const modules = symbol.getModuleCount();
    const dark: string[] = [];
    for (let row = 0; row < modules; row += 1) {
      for (let column = 0; column < modules; column += 1) {
        // One path per dark module, as 1×1 rects in module space — the viewBox
        // does the scaling, so nothing here depends on a pixel size.
        if (symbol.isDark(row, column)) dark.push(`M${column},${row}h1v1h-1z`);
      }
    }
    return { modules, path: dark.join('') };
  }, [value]);

  const side = grid.modules + QUIET_MODULES * 2;

  return (
    <span className={styles.plate}>
      <svg
        className={styles.code}
        viewBox={`0 0 ${side} ${side}`}
        role="img"
        aria-label={t('contestControl.scannableFor', { code })}
        // Crisp edges at any size: a QR module blurred by interpolation is a QR
        // module a scanner can misread.
        shapeRendering="crispEdges"
      >
        <path
          d={grid.path}
          transform={`translate(${QUIET_MODULES}, ${QUIET_MODULES})`}
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
