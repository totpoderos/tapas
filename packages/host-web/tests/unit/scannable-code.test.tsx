import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import qr from 'qrcode-generator';
import { ScannableCode } from '../../src/contests/scannable-code';
import '../../src/i18n';

const JOIN_URL = 'https://join.sobremesa.es/j/4KQ-207';

/**
 * What the code actually encodes, computed independently rather than snapshotted.
 *
 * A snapshot would only say "the same as last time", which is exactly as true of a
 * code encoding the wrong thing. Recomputing the module grid here means the test
 * fails if the component ever encodes anything but the value it was handed — the
 * bare join code, the contest's name, a link with the label glued on.
 */
function modulesFor(value: string): { count: number; dark: Set<string> } {
  const symbol = qr(0, 'M');
  symbol.addData(value);
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
  it('encodes the link that joins the contest, so a scan lands on the joining screen', () => {
    const { container } = render(<ScannableCode value={JOIN_URL} code="4KQ-207" />);

    const svg = container.querySelector('svg')!;
    expect(paintedModules(svg)).toEqual(modulesFor(JOIN_URL).dark);
  });

  it('encodes the link, and not the bare join code beside it', () => {
    const { container } = render(<ScannableCode value={JOIN_URL} code="4KQ-207" />);

    // The two are separate props precisely so one cannot stand in for the other:
    // scanning a bare code is what this change exists to stop doing.
    const svg = container.querySelector('svg')!;
    expect(paintedModules(svg)).not.toEqual(modulesFor('4KQ-207').dark);
  });

  it('encodes a different contest differently', () => {
    const { container: first } = render(<ScannableCode value={JOIN_URL} code="4KQ-207" />);
    const { container: second } = render(
      <ScannableCode value="https://join.sobremesa.es/j/9BD-114" code="9BD-114" />,
    );

    // Guards the tests above from passing on a component that ignores its input.
    expect(paintedModules(first.querySelector('svg')!)).not.toEqual(
      paintedModules(second.querySelector('svg')!),
    );
  });

  it('reads as an image naming the code it stands for, not the address it carries', () => {
    render(<ScannableCode value={JOIN_URL} code="4KQ-207" />);

    /*
     * Not "QR code", and not the link: what a screen-reader user needs is which
     * code this is, because that is the thing being handed to them — and an
     * address read out character by character is nobody's idea of useful.
     */
    const image = screen.getByRole('img', { name: /4KQ-207/ });
    expect(image).toBeInTheDocument();
    expect(image.getAttribute('aria-label')).not.toContain('https');
  });

  it('leaves a quiet border around the code, which scanners need to find its edges', () => {
    const { container } = render(<ScannableCode value={JOIN_URL} code="4KQ-207" />);

    const svg = container.querySelector('svg')!;
    const { count } = modulesFor(JOIN_URL);
    // Two modules of margin on every side.
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${count + 4} ${count + 4}`);
    expect(svg.querySelector('path')?.getAttribute('transform')).toBe('translate(2, 2)');
  });

  it('paints its modules in the inherited colour, so the plate decides them', () => {
    const { container } = render(<ScannableCode value={JOIN_URL} code="4KQ-207" />);

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
    const { container } = render(<ScannableCode value={JOIN_URL} code="4KQ-207" />);

    // A viewBox and no width/height attributes: the stylesheet sizes it in `em`, so
    // it grows with the text at 200% zoom. A link needs more modules than a code
    // did, which is exactly why the size cannot be pinned in pixels.
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBeTruthy();
    expect(svg.getAttribute('width')).toBeNull();
    expect(svg.getAttribute('height')).toBeNull();
  });
});
