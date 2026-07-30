import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import qr from 'qrcode-generator';
import { ScannableCode } from '../../src/contests/scannable-code';
import '../../src/i18n';

/**
 * What the code actually encodes, computed independently rather than snapshotted.
 *
 * A snapshot would only say "the same as last time", which is exactly as true of a
 * code encoding the wrong thing. Recomputing the module grid here means the test
 * fails if the component ever encodes anything but the join code — a URL, the
 * contest's name, a code with the label glued on.
 */
function modulesFor(code: string): { count: number; dark: Set<string> } {
  const symbol = qr(0, 'M');
  symbol.addData(code);
  symbol.make();
  const count = symbol.getModuleCount();
  const dark = new Set<string>();
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      if (symbol.isDark(row, column)) dark.add(`${column},${row}`);
    }
  }
  return { count, dark };
}

/** The module coordinates the rendered path actually paints. */
function paintedModules(svg: SVGElement): Set<string> {
  const path = svg.querySelector('path')?.getAttribute('d') ?? '';
  return new Set([...path.matchAll(/M(\d+),(\d+)h1v1h-1z/g)].map((m) => `${m[1]},${m[2]}`));
}

describe('ScannableCode', () => {
  it('encodes the join code, and nothing else', () => {
    const { container } = render(<ScannableCode code="4KQ-207" />);

    const svg = container.querySelector('svg')!;
    const expected = modulesFor('4KQ-207');
    expect(paintedModules(svg)).toEqual(expected.dark);
  });

  it('encodes a different code differently', () => {
    const { container: first } = render(<ScannableCode code="4KQ-207" />);
    const { container: second } = render(<ScannableCode code="9BD-114" />);

    // Guards the test above from passing on a component that ignores its input.
    expect(paintedModules(first.querySelector('svg')!)).not.toEqual(
      paintedModules(second.querySelector('svg')!),
    );
  });

  it('reads as an image naming the code it stands for', () => {
    render(<ScannableCode code="4KQ-207" />);

    // Not "QR code": what a screen-reader user needs is which code this is, since
    // the point of it is handing that code to somebody.
    expect(screen.getByRole('img', { name: /4KQ-207/ })).toBeInTheDocument();
  });

  it('leaves a quiet border around the code, which scanners need to find its edges', () => {
    const { container } = render(<ScannableCode code="4KQ-207" />);

    const svg = container.querySelector('svg')!;
    const { count } = modulesFor('4KQ-207');
    // Two modules of margin on every side.
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${count + 4} ${count + 4}`);
    expect(svg.querySelector('path')?.getAttribute('transform')).toBe('translate(2, 2)');
  });

  it('paints its modules in the inherited colour, so the plate decides them', () => {
    const { container } = render(<ScannableCode code="4KQ-207" />);

    /*
     * `currentColor`, inherited from a plate that is deliberately NOT theme-aware:
     * a QR is a machine-readable target and the standard assumes dark modules on a
     * light ground, so following the theme would invert it in the dark one and some
     * scanners refuse that. The plate is where those two colours are fixed.
     */
    const svg = container.querySelector('svg')!;
    expect(svg.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
    expect(svg.parentElement?.className).toMatch(/plate/);
  });

  it('scales with its box rather than to a pixel size', () => {
    const { container } = render(<ScannableCode code="4KQ-207" />);

    // A viewBox and no width/height attributes: the stylesheet sizes it in `em`, so
    // it grows with the text at 200% zoom.
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBeTruthy();
    expect(svg.getAttribute('width')).toBeNull();
    expect(svg.getAttribute('height')).toBeNull();
  });
});
