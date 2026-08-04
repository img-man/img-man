// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';

// ── DS-2.1 / DS-2.2 / DS-2.4: Text Helpers & Rich Text ───────────

import {
  DEFAULT_TYPOGRAPHY,
  TEXT_PRESETS,
  plainToRichText,
  richTextToPlain,
  hasRichFormatting,
  applyTextTransform,
  textShadowCSS,
  textShadowSVGFilter,
  textStrokeAttrs,
  measureTextApprox,
  autoResizeDimensions,
  type RichTextSpan,
  type RichTextParagraph,
  type TypographyExtras,
  type TextResizeMode,
  type TextPreset,
} from '@/components/design/text-helpers';

/* ════════════════════════════════════════════════════════════
 * DS-2.1 Rich Text Editing — Data Model
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.1 Rich Text — plainToRichText / richTextToPlain', () => {
  it('converts single-line plain text to one paragraph with one span', () => {
    const paras = plainToRichText('Hello world');
    expect(paras).toHaveLength(1);
    expect(paras[0].spans).toHaveLength(1);
    expect(paras[0].spans[0].text).toBe('Hello world');
  });

  it('converts multiline plain text to multiple paragraphs', () => {
    const paras = plainToRichText('Line 1\nLine 2\nLine 3');
    expect(paras).toHaveLength(3);
    expect(paras[0].spans[0].text).toBe('Line 1');
    expect(paras[1].spans[0].text).toBe('Line 2');
    expect(paras[2].spans[0].text).toBe('Line 3');
  });

  it('handles empty lines by inserting non-breaking space', () => {
    const paras = plainToRichText('A\n\nB');
    expect(paras).toHaveLength(3);
    expect(paras[1].spans[0].text).toBe('\u00A0');
  });

  it('applies default formatting overrides when provided', () => {
    const paras = plainToRichText('Hello', { bold: true, color: '#ff0000' });
    expect(paras[0].spans[0].bold).toBe(true);
    expect(paras[0].spans[0].color).toBe('#ff0000');
  });

  it('round-trips: plainToRichText -> richTextToPlain preserves text', () => {
    const original = 'Hello\nWorld\nFoo';
    const result = richTextToPlain(plainToRichText(original));
    expect(result).toBe(original);
  });

  it('richTextToPlain concatenates spans within paragraphs', () => {
    const paras: RichTextParagraph[] = [
      {
        spans: [
          { text: 'Hello ' },
          { text: 'world', bold: true },
        ],
      },
      { spans: [{ text: 'Second line' }] },
    ];
    expect(richTextToPlain(paras)).toBe('Hello world\nSecond line');
  });
});

describe('DS-2.1 Rich Text — hasRichFormatting', () => {
  it('returns false for plain single-span paragraphs', () => {
    const paras = plainToRichText('Hello');
    expect(hasRichFormatting(paras)).toBe(false);
  });

  it('returns true when a span has bold', () => {
    const paras: RichTextParagraph[] = [
      { spans: [{ text: 'Bold', bold: true }] },
    ];
    expect(hasRichFormatting(paras)).toBe(true);
  });

  it('returns true when a span has italic', () => {
    const paras: RichTextParagraph[] = [
      { spans: [{ text: 'Italic', italic: true }] },
    ];
    expect(hasRichFormatting(paras)).toBe(true);
  });

  it('returns true when a span has underline', () => {
    const paras: RichTextParagraph[] = [
      { spans: [{ text: 'Underline', underline: true }] },
    ];
    expect(hasRichFormatting(paras)).toBe(true);
  });

  it('returns true when a span has strikethrough', () => {
    const paras: RichTextParagraph[] = [
      { spans: [{ text: 'Strike', strikethrough: true }] },
    ];
    expect(hasRichFormatting(paras)).toBe(true);
  });

  it('returns true when a span has overline', () => {
    const paras: RichTextParagraph[] = [
      { spans: [{ text: 'Over', overline: true }] },
    ];
    expect(hasRichFormatting(paras)).toBe(true);
  });

  it('returns true when paragraph has multiple spans', () => {
    const paras: RichTextParagraph[] = [
      { spans: [{ text: 'A' }, { text: 'B' }] },
    ];
    expect(hasRichFormatting(paras)).toBe(true);
  });

  it('returns true when a span has a color override', () => {
    const paras: RichTextParagraph[] = [
      { spans: [{ text: 'Colored', color: '#ff0000' }] },
    ];
    expect(hasRichFormatting(paras)).toBe(true);
  });

  it('returns true when a span has a fontSize override', () => {
    const paras: RichTextParagraph[] = [
      { spans: [{ text: 'Big', fontSize: 32 }] },
    ];
    expect(hasRichFormatting(paras)).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════════
 * DS-2.2 Advanced Typography — Text Transform
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.2 Typography — applyTextTransform', () => {
  it('uppercase transforms correctly', () => {
    expect(applyTextTransform('hello world', 'uppercase')).toBe('HELLO WORLD');
  });

  it('lowercase transforms correctly', () => {
    expect(applyTextTransform('HELLO WORLD', 'lowercase')).toBe('hello world');
  });

  it('capitalize transforms first letter of each word', () => {
    expect(applyTextTransform('hello world foo', 'capitalize')).toBe(
      'Hello World Foo',
    );
  });

  it('none returns text unchanged', () => {
    expect(applyTextTransform('Hello World', 'none')).toBe('Hello World');
  });

  it('handles empty string', () => {
    expect(applyTextTransform('', 'uppercase')).toBe('');
  });
});

/* ════════════════════════════════════════════════════════════
 * DS-2.2 Typography — Text Shadow
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.2 Typography — textShadowCSS', () => {
  it('returns "none" when shadow color is transparent', () => {
    expect(textShadowCSS(DEFAULT_TYPOGRAPHY)).toBe('none');
  });

  it('returns "none" when all offset/blur values are zero', () => {
    expect(
      textShadowCSS({
        ...DEFAULT_TYPOGRAPHY,
        textShadowColor: '#000000',
        textShadowOffsetX: 0,
        textShadowOffsetY: 0,
        textShadowBlur: 0,
      }),
    ).toBe('none');
  });

  it('generates valid CSS shadow string', () => {
    const result = textShadowCSS({
      ...DEFAULT_TYPOGRAPHY,
      textShadowColor: '#000000',
      textShadowOffsetX: 2,
      textShadowOffsetY: 4,
      textShadowBlur: 6,
    });
    expect(result).toBe('2px 4px 6px #000000');
  });

  it('handles negative offsets', () => {
    const result = textShadowCSS({
      ...DEFAULT_TYPOGRAPHY,
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffsetX: -3,
      textShadowOffsetY: -1,
      textShadowBlur: 2,
    });
    expect(result).toBe('-3px -1px 2px rgba(0,0,0,0.5)');
  });
});

describe('DS-2.2 Typography — textShadowSVGFilter', () => {
  it('returns null when shadow is transparent', () => {
    expect(textShadowSVGFilter(DEFAULT_TYPOGRAPHY, 'f1')).toBeNull();
  });

  it('returns null when all offsets/blur are zero', () => {
    expect(
      textShadowSVGFilter(
        { ...DEFAULT_TYPOGRAPHY, textShadowColor: '#000' },
        'f1',
      ),
    ).toBeNull();
  });

  it('generates SVG filter with the correct filter id', () => {
    const result = textShadowSVGFilter(
      {
        ...DEFAULT_TYPOGRAPHY,
        textShadowColor: '#000',
        textShadowOffsetX: 2,
        textShadowOffsetY: 3,
        textShadowBlur: 4,
      },
      'my-shadow',
    );
    expect(result).toBeTruthy();
    expect(result).toContain('id="my-shadow"');
    expect(result).toContain('dx="2"');
    expect(result).toContain('dy="3"');
    expect(result).toContain('stdDeviation="2"'); // blur / 2
    expect(result).toContain('flood-color="#000"');
  });
});

/* ════════════════════════════════════════════════════════════
 * DS-2.2 Typography — Text Stroke
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.2 Typography — textStrokeAttrs', () => {
  it('returns null when stroke color is transparent', () => {
    expect(textStrokeAttrs(DEFAULT_TYPOGRAPHY)).toBeNull();
  });

  it('returns null when stroke width is 0', () => {
    expect(
      textStrokeAttrs({
        ...DEFAULT_TYPOGRAPHY,
        textStrokeColor: '#ff0000',
        textStrokeWidth: 0,
      }),
    ).toBeNull();
  });

  it('returns correct SVG attributes for stroke', () => {
    const result = textStrokeAttrs({
      ...DEFAULT_TYPOGRAPHY,
      textStrokeColor: '#ff0000',
      textStrokeWidth: 3,
    });
    expect(result).not.toBeNull();
    expect(result!.stroke).toBe('#ff0000');
    expect(result!.strokeWidth).toBe('3');
    expect(result!.paintOrder).toBe('stroke fill');
    expect(result!.strokeLinejoin).toBe('round');
  });
});

/* ════════════════════════════════════════════════════════════
 * DS-2.4 Text Containers — Auto-Resize
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.4 Container — measureTextApprox', () => {
  it('returns non-zero dimensions for text', () => {
    const m = measureTextApprox('Hello world', 16, 'sans-serif', 0, 1.2);
    expect(m.width).toBeGreaterThan(0);
    expect(m.height).toBeGreaterThan(0);
  });

  it('height grows with more lines', () => {
    const single = measureTextApprox('Line 1', 16, 'sans-serif', 0, 1.2);
    const multi = measureTextApprox('Line 1\nLine 2\nLine 3', 16, 'sans-serif', 0, 1.2);
    expect(multi.height).toBeGreaterThan(single.height);
  });

  it('width grows with letter spacing', () => {
    const normal = measureTextApprox('ABCDEF', 16, 'sans-serif', 0, 1.2);
    const spaced = measureTextApprox('ABCDEF', 16, 'sans-serif', 5, 1.2);
    expect(spaced.width).toBeGreaterThan(normal.width);
  });

  it('minimum width is at least 20', () => {
    const m = measureTextApprox('', 16, 'sans-serif', 0, 1.2);
    expect(m.width).toBeGreaterThanOrEqual(20);
  });
});

describe('DS-2.4 Container — autoResizeDimensions', () => {
  it('fixed mode returns current dimensions unchanged', () => {
    const dims = autoResizeDimensions('Hello', 16, 'sans-serif', 0, 1.2, 300, 40, 'fixed');
    expect(dims.width).toBe(300);
    expect(dims.height).toBe(40);
  });

  it('auto-width mode adjusts width based on text', () => {
    const dims = autoResizeDimensions(
      'A very long text string that should be wider',
      16,
      'sans-serif',
      0,
      1.2,
      100, // narrow current width
      40,
      'auto-width',
    );
    expect(dims.width).toBeGreaterThan(100);
  });

  it('auto-width mode has minimum width of 40', () => {
    const dims = autoResizeDimensions('X', 16, 'sans-serif', 0, 1.2, 300, 40, 'auto-width');
    expect(dims.width).toBeGreaterThanOrEqual(40);
  });

  it('auto-height mode keeps width fixed', () => {
    const dims = autoResizeDimensions(
      'Long text that may wrap\nMultiple lines',
      16,
      'sans-serif',
      0,
      1.2,
      200,
      40,
      'auto-height',
    );
    expect(dims.width).toBe(200);
    expect(dims.height).toBeGreaterThan(0);
  });

  it('auto-height mode grows height with more content', () => {
    const short = autoResizeDimensions('Hi', 16, 'sans-serif', 0, 1.2, 200, 40, 'auto-height');
    const long = autoResizeDimensions(
      'This is a very long text\nthat spans many lines\nand should be taller',
      16,
      'sans-serif',
      0,
      1.2,
      200,
      40,
      'auto-height',
    );
    expect(long.height).toBeGreaterThan(short.height);
  });
});

/* ════════════════════════════════════════════════════════════
 * DS-2.2 Typography — DEFAULT_TYPOGRAPHY constant
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.2 Typography — DEFAULT_TYPOGRAPHY', () => {
  it('has correct default values', () => {
    expect(DEFAULT_TYPOGRAPHY.letterSpacing).toBe(0);
    expect(DEFAULT_TYPOGRAPHY.lineHeight).toBe(1.2);
    expect(DEFAULT_TYPOGRAPHY.textTransform).toBe('none');
    expect(DEFAULT_TYPOGRAPHY.textShadowColor).toBe('transparent');
    expect(DEFAULT_TYPOGRAPHY.textShadowOffsetX).toBe(0);
    expect(DEFAULT_TYPOGRAPHY.textShadowOffsetY).toBe(0);
    expect(DEFAULT_TYPOGRAPHY.textShadowBlur).toBe(0);
    expect(DEFAULT_TYPOGRAPHY.textStrokeColor).toBe('transparent');
    expect(DEFAULT_TYPOGRAPHY.textStrokeWidth).toBe(0);
    expect(DEFAULT_TYPOGRAPHY.textDecorationStyle).toBe('none');
  });

  it('has all required TypographyExtras keys', () => {
    const keys: (keyof TypographyExtras)[] = [
      'letterSpacing',
      'lineHeight',
      'textTransform',
      'textShadowColor',
      'textShadowOffsetX',
      'textShadowOffsetY',
      'textShadowBlur',
      'textStrokeColor',
      'textStrokeWidth',
      'textDecorationStyle',
    ];
    for (const key of keys) {
      expect(DEFAULT_TYPOGRAPHY).toHaveProperty(key);
    }
  });
});

/* ════════════════════════════════════════════════════════════
 * DS-2.2 Typography — TEXT_PRESETS
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.2 Typography — TEXT_PRESETS', () => {
  it('has 8 presets', () => {
    expect(TEXT_PRESETS).toHaveLength(8);
  });

  it('every preset has a unique id', () => {
    const ids = TEXT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has required fields', () => {
    for (const preset of TEXT_PRESETS) {
      expect(preset).toHaveProperty('id');
      expect(preset).toHaveProperty('name');
      expect(typeof preset.name).toBe('string');
      expect(typeof preset.fontSize).toBe('number');
      expect(preset.fontSize).toBeGreaterThan(0);
      expect(typeof preset.fontFamily).toBe('string');
      expect(typeof preset.fontWeight).toBe('string');
      expect(typeof preset.color).toBe('string');
      expect(typeof preset.letterSpacing).toBe('number');
      expect(typeof preset.lineHeight).toBe('number');
      expect(preset.lineHeight).toBeGreaterThan(0);
    }
  });

  it('includes expected preset names', () => {
    const names = TEXT_PRESETS.map((p) => p.name);
    expect(names).toContain('Heading 1');
    expect(names).toContain('Heading 2');
    expect(names).toContain('Heading 3');
    expect(names).toContain('Subheading');
    expect(names).toContain('Body');
    expect(names).toContain('Caption');
    expect(names).toContain('Display');
    expect(names).toContain('Monospace');
  });

  it('Heading 1 has the largest font size', () => {
    const h1 = TEXT_PRESETS.find((p) => p.id === 'heading-1')!;
    const body = TEXT_PRESETS.find((p) => p.id === 'body')!;
    expect(h1.fontSize).toBeGreaterThan(body.fontSize);
  });

  it('Display preset uses a serif/display font', () => {
    const display = TEXT_PRESETS.find((p) => p.id === 'display')!;
    expect(display.fontFamily).toBe('Playfair Display');
    expect(display.fontSize).toBe(64);
  });

  it('Monospace preset uses a monospace font', () => {
    const mono = TEXT_PRESETS.find((p) => p.id === 'mono')!;
    expect(mono.fontFamily).toBe('JetBrains Mono');
  });

  it('Subheading uses uppercase text transform', () => {
    const sub = TEXT_PRESETS.find((p) => p.id === 'subheading')!;
    expect(sub.textTransform).toBe('uppercase');
  });
});

/* ════════════════════════════════════════════════════════════
 * DS-2.2 Typography Panel — Exported Constants
 * ════════════════════════════════════════════════════════════ */

import {
  TRANSFORM_OPTIONS,
  DECORATION_OPTIONS,
  RESIZE_MODES,
} from '@/components/design/typography-panel';

describe('DS-2.2 TypographyPanel — TRANSFORM_OPTIONS', () => {
  it('has 4 text transform options', () => {
    expect(TRANSFORM_OPTIONS).toHaveLength(4);
  });

  it('includes none, uppercase, lowercase, capitalize', () => {
    const values = TRANSFORM_OPTIONS.map((o) => o.value);
    expect(values).toContain('none');
    expect(values).toContain('uppercase');
    expect(values).toContain('lowercase');
    expect(values).toContain('capitalize');
  });

  it('each option has a label and value', () => {
    for (const opt of TRANSFORM_OPTIONS) {
      expect(typeof opt.label).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
      expect(typeof opt.value).toBe('string');
    }
  });
});

describe('DS-2.2 TypographyPanel — DECORATION_OPTIONS', () => {
  it('has 4 text decoration options', () => {
    expect(DECORATION_OPTIONS).toHaveLength(4);
  });

  it('includes none, underline, line-through, overline', () => {
    const values = DECORATION_OPTIONS.map((o) => o.value);
    expect(values).toContain('none');
    expect(values).toContain('underline');
    expect(values).toContain('line-through');
    expect(values).toContain('overline');
  });
});

describe('DS-2.4 TypographyPanel — RESIZE_MODES', () => {
  it('has 3 resize modes', () => {
    expect(RESIZE_MODES).toHaveLength(3);
  });

  it('includes fixed, auto-width, auto-height', () => {
    const values = RESIZE_MODES.map((m) => m.value);
    expect(values).toContain('fixed');
    expect(values).toContain('auto-width');
    expect(values).toContain('auto-height');
  });

  it('each mode has a label, value, and icon', () => {
    for (const mode of RESIZE_MODES) {
      expect(typeof mode.label).toBe('string');
      expect(typeof mode.value).toBe('string');
      expect(mode.icon).toBeTruthy();
    }
  });
});

/* ════════════════════════════════════════════════════════════
 * Type-level checks — TextResizeMode type
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.4 TextResizeMode type', () => {
  it('accepts valid resize modes', () => {
    const modes: TextResizeMode[] = ['fixed', 'auto-width', 'auto-height'];
    expect(modes).toHaveLength(3);
    for (const m of modes) {
      expect(['fixed', 'auto-width', 'auto-height']).toContain(m);
    }
  });
});

/* ════════════════════════════════════════════════════════════
 * Integration: RichTextParagraph model structure
 * ════════════════════════════════════════════════════════════ */

describe('DS-2.1 RichTextParagraph integration', () => {
  it('paragraph with align property', () => {
    const para: RichTextParagraph = {
      spans: [{ text: 'Centered' }],
      align: 'center',
    };
    expect(para.align).toBe('center');
    expect(para.spans[0].text).toBe('Centered');
  });

  it('span supports all formatting flags', () => {
    const span: RichTextSpan = {
      text: 'Formatted',
      bold: true,
      italic: true,
      underline: true,
      strikethrough: true,
      overline: true,
      color: '#ff0000',
      fontSize: 24,
      fontFamily: 'Arial',
    };
    expect(span.bold).toBe(true);
    expect(span.italic).toBe(true);
    expect(span.underline).toBe(true);
    expect(span.strikethrough).toBe(true);
    expect(span.overline).toBe(true);
    expect(span.color).toBe('#ff0000');
    expect(span.fontSize).toBe(24);
    expect(span.fontFamily).toBe('Arial');
  });

  it('complex rich text with mixed formatting per paragraph', () => {
    const paras: RichTextParagraph[] = [
      {
        spans: [
          { text: 'Normal text ' },
          { text: 'bold part', bold: true },
          { text: ' and ', italic: true },
          { text: 'underlined', underline: true },
        ],
        align: 'left',
      },
      {
        spans: [{ text: 'Second paragraph', color: '#0000ff' }],
        align: 'center',
      },
    ];

    const plain = richTextToPlain(paras);
    expect(plain).toBe('Normal text bold part and underlined\nSecond paragraph');
    expect(hasRichFormatting(paras)).toBe(true);
  });
});
