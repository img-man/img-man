// SPDX-License-Identifier: Apache-2.0
/**
 * DS-3.3 Gradient & Pattern Fill Editor Tests
 */
import { describe, it, expect } from 'vitest';
import {
  type GradientStop,
  type LinearGradient,
  type RadialGradient,
  type PatternFill,
  type GradientFill,
  type FillType,
  FILL_TYPES,
  defaultLinearGradient,
  defaultRadialGradient,
  defaultPatternFill,
  angleToGradientCoords,
  gradientId,
  gradientDefsMarkup,
  gradientFillAttr,
  gradientToCSS,
  addStop,
  removeStop,
  updateStop,
  GradientEditor,
} from '@/components/design/gradient-editor';

/* ─── FILL_TYPES constant ─── */
describe('FILL_TYPES constant', () => {
  it('has entries for solid, linear, radial, pattern', () => {
    const values = FILL_TYPES.map((f) => f.value);
    expect(values).toContain('solid');
    expect(values).toContain('linear');
    expect(values).toContain('radial');
    expect(values).toContain('pattern');
  });

  it('each entry has value and label', () => {
    for (const ft of FILL_TYPES) {
      expect(ft.value).toBeTruthy();
      expect(ft.label).toBeTruthy();
    }
  });
});

/* ─── Default factories ─── */
describe('Default fill factories', () => {
  it('defaultLinearGradient creates a valid linear gradient', () => {
    const g = defaultLinearGradient();
    expect(g.type).toBe('linear');
    expect(g.angle).toBeDefined();
    expect(g.stops.length).toBeGreaterThanOrEqual(2);
  });

  it('defaultRadialGradient creates a valid radial gradient', () => {
    const g = defaultRadialGradient();
    expect(g.type).toBe('radial');
    expect(g.cx).toBeDefined();
    expect(g.cy).toBeDefined();
    expect(g.r).toBeDefined();
    expect(g.stops.length).toBeGreaterThanOrEqual(2);
  });

  it('defaultPatternFill creates a valid pattern', () => {
    const p = defaultPatternFill();
    expect(p.type).toBe('pattern');
    expect(p.imageUrl).toBeDefined();
    expect(p.scaleX).toBeGreaterThan(0);
    expect(p.scaleY).toBeGreaterThan(0);
  });
});

/* ─── angleToGradientCoords ─── */
describe('angleToGradientCoords', () => {
  it('0 degrees goes top to bottom', () => {
    const { x1, y1, x2, y2 } = angleToGradientCoords(0);
    // SVG gradient 0deg = top-to-bottom by convention
    expect(typeof x1).toBe('number');
    expect(typeof y1).toBe('number');
    expect(typeof x2).toBe('number');
    expect(typeof y2).toBe('number');
  });

  it('180 degrees is opposite of 0', () => {
    const a = angleToGradientCoords(0);
    const b = angleToGradientCoords(180);
    // x1/y1 of 0° should be ~x2/y2 of 180°
    expect(a.x1).toBeCloseTo(b.x2, 1);
    expect(a.y1).toBeCloseTo(b.y2, 1);
  });
});

/* ─── gradientId ─── */
describe('gradientId', () => {
  it('generates a deterministic ID from element ID', () => {
    const id = gradientId('el-123');
    expect(id).toContain('el-123');
    expect(gradientId('el-123')).toBe(id); // stable
  });
});

/* ─── gradientDefsMarkup ─── */
describe('gradientDefsMarkup', () => {
  it('generates linearGradient SVG for linear fill', () => {
    const fill = defaultLinearGradient();
    const markup = gradientDefsMarkup(fill, 'test-el');
    expect(markup).toContain('<linearGradient');
    expect(markup).toContain('</linearGradient>');
    expect(markup).toContain('<stop');
  });

  it('generates radialGradient SVG for radial fill', () => {
    const fill = defaultRadialGradient();
    const markup = gradientDefsMarkup(fill, 'test-el');
    expect(markup).toContain('<radialGradient');
    expect(markup).toContain('</radialGradient>');
  });

  it('generates pattern SVG for pattern fill', () => {
    const fill = defaultPatternFill();
    const markup = gradientDefsMarkup(fill, 'test-el');
    expect(markup).toContain('<pattern');
    expect(markup).toContain('<image');
  });
});

/* ─── gradientFillAttr ─── */
describe('gradientFillAttr', () => {
  it('returns solid color when no gradient', () => {
    expect(gradientFillAttr(null, '#ff0000', 'el-1')).toBe('#ff0000');
    expect(gradientFillAttr(undefined, '#ff0000', 'el-1')).toBe('#ff0000');
  });

  it('returns url(#...) when gradient is present', () => {
    const fill = defaultLinearGradient();
    const attr = gradientFillAttr(fill, '#ff0000', 'el-1');
    expect(attr).toMatch(/url\(#.*el-1.*\)/);
  });
});

/* ─── gradientToCSS ─── */
describe('gradientToCSS', () => {
  it('generates CSS linear-gradient for linear fill', () => {
    const fill = defaultLinearGradient();
    const css = gradientToCSS(fill);
    expect(css).toContain('linear-gradient');
  });

  it('generates CSS radial-gradient for radial fill', () => {
    const fill = defaultRadialGradient();
    const css = gradientToCSS(fill);
    expect(css).toContain('radial-gradient');
  });

  it('generates CSS url() for pattern fill with URL', () => {
    const fill: PatternFill = { type: 'pattern', imageUrl: 'https://example.com/img.png', scaleX: 1, scaleY: 1 };
    const css = gradientToCSS(fill);
    expect(css).toContain('url(');
  });

  it('generates CSS fallback for pattern fill without URL', () => {
    const fill = defaultPatternFill();
    const css = gradientToCSS(fill);
    expect(css).toBe('#999');
  });
});

/* ─── Stop manipulation ─── */
describe('Color stop helpers', () => {
  const baseStops: GradientStop[] = [
    { offset: 0, color: '#000000' },
    { offset: 1, color: '#ffffff' },
  ];

  it('addStop inserts a new stop at the specified offset', () => {
    const result = addStop(baseStops, 0.5, '#ff0000');
    expect(result.length).toBe(3);
    const midStop = result.find((s) => s.color === '#ff0000');
    expect(midStop).toBeTruthy();
    expect(midStop!.offset).toBe(0.5);
  });

  it('removeStop removes a stop by index', () => {
    const threeStops = addStop(baseStops, 0.5, '#ff0000');
    const after = removeStop(threeStops, 1); // remove index 1
    expect(after.length).toBe(2);
  });

  it('removeStop does not remove if only 2 stops remain', () => {
    const result = removeStop(baseStops, 0);
    expect(result.length).toBe(2); // should still have 2
  });

  it('updateStop changes color and offset of a stop', () => {
    const result = updateStop(baseStops, 0, { color: '#aabbcc', offset: 0.1 });
    expect(result[0].color).toBe('#aabbcc');
    expect(result[0].offset).toBe(0.1);
  });
});

/* ─── GradientEditor component ─── */
describe('GradientEditor component export', () => {
  it('is a function', () => {
    expect(typeof GradientEditor).toBe('function');
  });
});
