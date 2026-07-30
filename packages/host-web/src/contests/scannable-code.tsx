import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import qr from 'qrcode-generator';
import styles from './scannable-code.module.css';

/** A quiet border around the code, in modules. Scanners need it to find the edges. */
const QUIET_MODULES = 2;

export interface ScannableCodeProps {
  /** The join code, and the only thing this encodes. */
  readonly code: string;
}

/**
 * A join code as something a phone can point at.
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
 * It encodes the join code text and nothing else. A join code is meant to be
 * handed to strangers; anything else about the contest is not. It is also all a
 * scan can usefully yield today — nothing tells this app the participant app's
 * public address, so a scan gives the code, which the person then types. That is
 * why the code stays printed beside this and copying stays on offer.
 */
export function ScannableCode({ code }: ScannableCodeProps) {
  const { t } = useTranslation();

  const grid = useMemo(() => {
    // Version 0 lets the library pick the smallest that fits; 'M' is the usual
    // middle error-correction level, which tolerates a smudged print.
    const symbol = qr(0, 'M');
    symbol.addData(code);
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
  }, [code]);

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
