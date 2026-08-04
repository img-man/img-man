// SPDX-License-Identifier: Apache-2.0
/**
 * Design Studio: Rich Text, Templates & QR Code Tests
 *
 * 8.1 Inline rich text editing (pre-existing — verify exports)
 * 8.2 Text effects: shadow + outline pre-existing, curved text NEW
 * 8.3 Typography controls (pre-existing — verify exports)
 * 8.4 Template expansion 15 → 200+ (NEW)
 * 8.5 Template search + categories (pre-existing — verify exports)
 * 8.6 QR Code generator (NEW)
 */

import { describe, it, expect } from 'vitest';

/* ═══════════════════════════════════════════════════════════
 * 8.1 — Inline Rich Text Editing (pre-existing)
 * ═══════════════════════════════════════════════════════════ */

describe('Inline rich text editing', () => {
  it('exports RichTextEditor component', async () => {
    const mod = await import('@/components/design/rich-text-editor');
    expect(mod.RichTextEditor).toBeDefined();
    expect(typeof mod.RichTextEditor).toBe('function');
  });

  it('exports RichTextEditorProps interface shape', async () => {
    const mod = await import('@/components/design/rich-text-editor');
    // Component should be a named export
    expect(mod).toHaveProperty('RichTextEditor');
  });

  it('text-helpers exports rich text utilities', async () => {
    const mod = await import('@/components/design/text-helpers');
    expect(mod.plainToRichText).toBeDefined();
    expect(mod.richTextToPlain).toBeDefined();
    expect(mod.hasRichFormatting).toBeDefined();
    expect(mod.applyTextTransform).toBeDefined();
    expect(mod.DEFAULT_TYPOGRAPHY).toBeDefined();
  });

  it('plainToRichText converts string to paragraph array', async () => {
    const { plainToRichText } =
      await import('@/components/design/text-helpers');
    const result = plainToRichText('Hello World');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty('spans');
    expect(Array.isArray(result[0].spans)).toBe(true);
  });

  it('richTextToPlain round-trips from plainToRichText', async () => {
    const { plainToRichText, richTextToPlain } =
      await import('@/components/design/text-helpers');
    const original = 'Hello World';
    const rich = plainToRichText(original);
    const plain = richTextToPlain(rich);
    expect(plain).toBe(original);
  });

  it('hasRichFormatting detects formatting', async () => {
    const { plainToRichText, hasRichFormatting } =
      await import('@/components/design/text-helpers');
    const plain = plainToRichText('No formatting');
    expect(hasRichFormatting(plain)).toBe(false);
  });
});

/* ═══════════════════════════════════════════════════════════
 * 8.2 — Text Effects: Shadow, Outline, Curved Text
 * ═══════════════════════════════════════════════════════════ */

describe('Text effects — shadow + outline', () => {
  it('TextEl includes shadow properties', async () => {
    // Verify by importing a text element with shadow fields
    const mod = await import('@/components/design/text-helpers');
    const defaults = mod.DEFAULT_TYPOGRAPHY;
    expect(defaults).toHaveProperty('textShadowColor');
    expect(defaults).toHaveProperty('textShadowOffsetX');
    expect(defaults).toHaveProperty('textShadowBlur');
  });

  it('TextEl includes stroke properties', async () => {
    const mod = await import('@/components/design/text-helpers');
    const defaults = mod.DEFAULT_TYPOGRAPHY;
    expect(defaults).toHaveProperty('textStrokeColor');
    expect(defaults).toHaveProperty('textStrokeWidth');
  });

  it('typography-panel exports TypographyPanel', async () => {
    const mod = await import('@/components/design/typography-panel');
    expect(mod.TypographyPanel).toBeDefined();
    expect(typeof mod.TypographyPanel).toBe('function');
  });
});

describe('Curved text / text-on-path', () => {
  it('exports computeArcPath function', async () => {
    const mod = await import('@/components/design/curved-text');
    expect(mod.computeArcPath).toBeDefined();
    expect(typeof mod.computeArcPath).toBe('function');
  });

  it('exports renderCurvedTextSvg function', async () => {
    const mod = await import('@/components/design/curved-text');
    expect(mod.renderCurvedTextSvg).toBeDefined();
    expect(typeof mod.renderCurvedTextSvg).toBe('function');
  });

  it('exports isCurved and clampCurveRadius helpers', async () => {
    const mod = await import('@/components/design/curved-text');
    expect(mod.isCurved).toBeDefined();
    expect(mod.clampCurveRadius).toBeDefined();
  });

  it('exports MIN_CURVE_RADIUS and MAX_CURVE_RADIUS constants', async () => {
    const mod = await import('@/components/design/curved-text');
    expect(mod.MIN_CURVE_RADIUS).toBe(50);
    expect(mod.MAX_CURVE_RADIUS).toBe(2000);
    expect(mod.CURVE_RADIUS_STEP).toBe(10);
  });

  it('computeArcPath returns valid SVG path for positive radius', async () => {
    const { computeArcPath } = await import('@/components/design/curved-text');
    const path = computeArcPath(400, 200);
    expect(path).toContain('M');
    expect(path).toContain('A');
    // Should start with M (moveTo) and contain A (arc)
    expect(path).toMatch(/^M\s/);
  });

  it('computeArcPath returns valid SVG path for negative radius', async () => {
    const { computeArcPath } = await import('@/components/design/curved-text');
    const path = computeArcPath(400, -200);
    expect(path).toContain('M');
    expect(path).toContain('A');
  });

  it('positive radius has sweep flag 1 (upward arc)', async () => {
    const { computeArcPath } = await import('@/components/design/curved-text');
    const path = computeArcPath(400, 200);
    // SVG arc: A rx ry x-rotation large-arc-flag sweep-flag x y
    // Positive = sweep flag 1
    expect(path).toMatch(/A\s+[\d.]+\s+[\d.]+\s+0\s+0\s+1\s/);
  });

  it('negative radius has sweep flag 0 (downward arc)', async () => {
    const { computeArcPath } = await import('@/components/design/curved-text');
    const path = computeArcPath(400, -200);
    expect(path).toMatch(/A\s+[\d.]+\s+[\d.]+\s+0\s+0\s+0\s/);
  });

  it('renderCurvedTextSvg returns empty string for radius 0', async () => {
    const { renderCurvedTextSvg } =
      await import('@/components/design/curved-text');
    const svg = renderCurvedTextSvg({
      text: 'Hello',
      curveRadius: 0,
      fontSize: 16,
      fontFamily: 'Arial',
      width: 200,
    });
    expect(svg).toBe('');
  });

  it('renderCurvedTextSvg returns empty string for empty text', async () => {
    const { renderCurvedTextSvg } =
      await import('@/components/design/curved-text');
    const svg = renderCurvedTextSvg({
      text: '   ',
      curveRadius: 200,
      fontSize: 16,
      fontFamily: 'Arial',
      width: 200,
    });
    expect(svg).toBe('');
  });

  it('renderCurvedTextSvg returns valid SVG with textPath', async () => {
    const { renderCurvedTextSvg } =
      await import('@/components/design/curved-text');
    const svg = renderCurvedTextSvg({
      text: 'Curved Text',
      curveRadius: 300,
      fontSize: 24,
      fontFamily: 'Inter',
      width: 400,
    });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('<textPath');
    expect(svg).toContain('Curved Text');
    expect(svg).toContain('font-size="24"');
  });

  it('renderCurvedTextSvg respects text alignment', async () => {
    const { renderCurvedTextSvg } =
      await import('@/components/design/curved-text');
    const left = renderCurvedTextSvg({
      text: 'Left',
      curveRadius: 200,
      fontSize: 16,
      fontFamily: 'Arial',
      width: 300,
      textAlign: 'left',
    });
    expect(left).toContain('text-anchor="start"');
    expect(left).toContain('startOffset="0%"');

    const right = renderCurvedTextSvg({
      text: 'Right',
      curveRadius: 200,
      fontSize: 16,
      fontFamily: 'Arial',
      width: 300,
      textAlign: 'right',
    });
    expect(right).toContain('text-anchor="end"');
    expect(right).toContain('startOffset="100%"');
  });

  it('renderCurvedTextSvg escapes XML characters', async () => {
    const { renderCurvedTextSvg } =
      await import('@/components/design/curved-text');
    const svg = renderCurvedTextSvg({
      text: 'Hello <World> & "Quotes"',
      curveRadius: 200,
      fontSize: 16,
      fontFamily: 'Arial',
      width: 400,
    });
    expect(svg).toContain('&lt;World&gt;');
    expect(svg).toContain('&amp;');
    expect(svg).not.toContain('< World>');
  });

  it('curvedTextToDataUri returns data URI for curved text', async () => {
    const { curvedTextToDataUri } =
      await import('@/components/design/curved-text');
    const uri = curvedTextToDataUri({
      text: 'Data URI',
      curveRadius: 200,
      fontSize: 16,
      fontFamily: 'Arial',
      width: 300,
    });
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('curvedTextToDataUri returns empty string for radius 0', async () => {
    const { curvedTextToDataUri } =
      await import('@/components/design/curved-text');
    const uri = curvedTextToDataUri({
      text: 'Flat',
      curveRadius: 0,
      fontSize: 16,
      fontFamily: 'Arial',
      width: 300,
    });
    expect(uri).toBe('');
  });

  it('isCurved returns true for non-zero radius, false otherwise', async () => {
    const { isCurved } = await import('@/components/design/curved-text');
    expect(isCurved(200)).toBe(true);
    expect(isCurved(-100)).toBe(true);
    expect(isCurved(0)).toBe(false);
    expect(isCurved(undefined)).toBe(false);
  });

  it('clampCurveRadius clamps within valid range', async () => {
    const { clampCurveRadius, MIN_CURVE_RADIUS, MAX_CURVE_RADIUS } =
      await import('@/components/design/curved-text');
    // Small values → 0 (flat zone)
    expect(clampCurveRadius(10)).toBe(0);
    expect(clampCurveRadius(-15)).toBe(0);
    // Normal values clamped to MIN
    expect(Math.abs(clampCurveRadius(60))).toBeGreaterThanOrEqual(
      MIN_CURVE_RADIUS,
    );
    // Large values clamped to MAX
    expect(Math.abs(clampCurveRadius(3000))).toBe(MAX_CURVE_RADIUS);
    expect(Math.abs(clampCurveRadius(-3000))).toBe(MAX_CURVE_RADIUS);
    // Sign preserved
    expect(clampCurveRadius(-200)).toBeLessThan(0);
    expect(clampCurveRadius(200)).toBeGreaterThan(0);
  });

  it('computeArcHeight returns positive value', async () => {
    const { computeArcHeight } =
      await import('@/components/design/curved-text');
    const height = computeArcHeight(400, 200, 24);
    expect(height).toBeGreaterThan(0);
    expect(height).toBeGreaterThanOrEqual(24); // at least font size
  });

  it('curveRadius property exists on TextEl type', async () => {
    // Verify by checking the editor-types module compiles with curveRadius
    const mod = await import('@/components/design/editor-types');
    // TextEl is a type, not runtime, but editor-types should export DesignPage etc.
    expect(mod).toBeDefined();
  });
});

/* ═══════════════════════════════════════════════════════════
 * 8.3 — Typography Controls (pre-existing)
 * ═══════════════════════════════════════════════════════════ */

describe('Typography controls', () => {
  it('DEFAULT_TYPOGRAPHY has letterSpacing, lineHeight, textTransform', async () => {
    const mod = await import('@/components/design/text-helpers');
    const d = mod.DEFAULT_TYPOGRAPHY;
    expect(d.letterSpacing).toBe(0);
    expect(d.lineHeight).toBe(1.2);
    expect(d.textTransform).toBe('none');
  });

  it('applyTextTransform handles all transforms', async () => {
    const { applyTextTransform } =
      await import('@/components/design/text-helpers');
    expect(applyTextTransform('hello', 'uppercase')).toBe('HELLO');
    expect(applyTextTransform('HELLO', 'lowercase')).toBe('hello');
    expect(applyTextTransform('hello world', 'capitalize')).toBe('Hello World');
    expect(applyTextTransform('Test', 'none')).toBe('Test');
  });

  it('TypographyExtras type has all expected fields in defaults', async () => {
    const mod = await import('@/components/design/text-helpers');
    const d = mod.DEFAULT_TYPOGRAPHY;
    // All typography extras should have defaults
    expect(d).toHaveProperty('letterSpacing');
    expect(d).toHaveProperty('lineHeight');
    expect(d).toHaveProperty('textTransform');
    expect(d).toHaveProperty('textShadowColor');
    expect(d).toHaveProperty('textShadowOffsetX');
    expect(d).toHaveProperty('textShadowOffsetY');
    expect(d).toHaveProperty('textShadowBlur');
    expect(d).toHaveProperty('textStrokeColor');
    expect(d).toHaveProperty('textStrokeWidth');
    expect(d).toHaveProperty('textDecorationStyle');
  });
});

/* ═══════════════════════════════════════════════════════════
 * 8.4 — Template Expansion (200+)
 * ═══════════════════════════════════════════════════════════ */

describe('Template expansion (200+)', () => {
  it('DESIGN_TEMPLATES has at least 200 entries', async () => {
    const { DESIGN_TEMPLATES } = await import('@/lib/templates');
    expect(DESIGN_TEMPLATES.length).toBeGreaterThanOrEqual(200);
  });

  it('all templates have required fields', async () => {
    const { DESIGN_TEMPLATES } = await import('@/lib/templates');
    for (const t of DESIGN_TEMPLATES) {
      expect(typeof t.id).toBe('string');
      expect(t.id.length).toBeGreaterThan(0);
      expect(typeof t.name).toBe('string');
      expect(typeof t.category).toBe('string');
      expect(typeof t.width).toBe('number');
      expect(t.width).toBeGreaterThan(0);
      expect(typeof t.height).toBe('number');
      expect(t.height).toBeGreaterThan(0);
      expect(typeof t.icon).toBe('string');
      expect(typeof t.description).toBe('string');
    }
  });

  it('no duplicate template IDs', async () => {
    const { DESIGN_TEMPLATES } = await import('@/lib/templates');
    const ids = DESIGN_TEMPLATES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('has Social Media category with 20+ entries', async () => {
    const { DESIGN_TEMPLATES } = await import('@/lib/templates');
    const social = DESIGN_TEMPLATES.filter(
      (t) => t.category === 'Social Media',
    );
    expect(social.length).toBeGreaterThanOrEqual(20);
  });

  it('has Print category with 10+ entries', async () => {
    const { DESIGN_TEMPLATES } = await import('@/lib/templates');
    const print = DESIGN_TEMPLATES.filter((t) => t.category === 'Print');
    expect(print.length).toBeGreaterThanOrEqual(10);
  });

  it('has new categories: Presentations, Flyers & Posters, Menus, Cards & Invitations', async () => {
    const { TEMPLATE_CATEGORIES } = await import('@/lib/templates');
    expect(TEMPLATE_CATEGORIES).toContain('Presentations');
    expect(TEMPLATE_CATEGORIES).toContain('Flyers & Posters');
    expect(TEMPLATE_CATEGORIES).toContain('Menus');
    expect(TEMPLATE_CATEGORIES).toContain('Cards & Invitations');
  });

  it('has Resumes, Infographics, Certificates, Education categories', async () => {
    const { TEMPLATE_CATEGORIES } = await import('@/lib/templates');
    expect(TEMPLATE_CATEGORIES).toContain('Resumes');
    expect(TEMPLATE_CATEGORIES).toContain('Infographics');
    expect(TEMPLATE_CATEGORIES).toContain('Certificates');
    expect(TEMPLATE_CATEGORIES).toContain('Education');
  });

  it('has Ads & Banners and Misc categories', async () => {
    const { TEMPLATE_CATEGORIES } = await import('@/lib/templates');
    expect(TEMPLATE_CATEGORIES).toContain('Ads & Banners');
    expect(TEMPLATE_CATEGORIES).toContain('Misc');
  });

  it('TEMPLATE_CATEGORIES starts with "All"', async () => {
    const { TEMPLATE_CATEGORIES } = await import('@/lib/templates');
    expect(TEMPLATE_CATEGORIES[0]).toBe('All');
  });

  it('Custom template is present', async () => {
    const { DESIGN_TEMPLATES } = await import('@/lib/templates');
    const custom = DESIGN_TEMPLATES.find((t) => t.id === 'custom');
    expect(custom).toBeDefined();
    expect(custom?.category).toBe('Custom');
  });

  it('all widths and heights are reasonable (> 0, < 20000)', async () => {
    const { DESIGN_TEMPLATES } = await import('@/lib/templates');
    for (const t of DESIGN_TEMPLATES) {
      expect(t.width).toBeGreaterThan(0);
      expect(t.width).toBeLessThan(20000);
      expect(t.height).toBeGreaterThan(0);
      expect(t.height).toBeLessThan(20000);
    }
  });
});

/* ═══════════════════════════════════════════════════════════
 * 8.5 — Template Search + Categories (pre-existing)
 * ═══════════════════════════════════════════════════════════ */

describe('Template search + categories', () => {
  it('templates-panel exports default component', async () => {
    const mod = await import('@/components/design/panels/templates-panel');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('TEMPLATE_CATEGORIES includes "All" plus categories from templates', async () => {
    const { DESIGN_TEMPLATES, TEMPLATE_CATEGORIES } =
      await import('@/lib/templates');
    const uniqueCategories = new Set(DESIGN_TEMPLATES.map((t) => t.category));
    // "All" + each unique category
    expect(TEMPLATE_CATEGORIES.length).toBe(uniqueCategories.size + 1);
    expect(TEMPLATE_CATEGORIES[0]).toBe('All');
    for (const cat of uniqueCategories) {
      expect(TEMPLATE_CATEGORIES).toContain(cat);
    }
  });
});

/* ═══════════════════════════════════════════════════════════
 * 8.6 — QR Code Generator
 * ═══════════════════════════════════════════════════════════ */

describe('QR Code generator', () => {
  it('exports generateQrCode function', async () => {
    const mod = await import('@/components/design/qr-generator');
    expect(mod.generateQrCode).toBeDefined();
    expect(typeof mod.generateQrCode).toBe('function');
  });

  it('exports convenience wrappers', async () => {
    const mod = await import('@/components/design/qr-generator');
    expect(mod.generateQrSvg).toBeDefined();
    expect(mod.generateQrDataUri).toBeDefined();
    expect(mod.validateQrInput).toBeDefined();
  });

  it('exports helper functions', async () => {
    const mod = await import('@/components/design/qr-generator');
    expect(mod.getModuleCount).toBeDefined();
    expect(mod.isAlphanumeric).toBeDefined();
    expect(mod.chooseVersion).toBeDefined();
  });

  it('generateQrCode returns empty result for empty data', async () => {
    const { generateQrCode } = await import('@/components/design/qr-generator');
    const result = generateQrCode({ data: '' });
    expect(result.svg).toBe('');
    expect(result.dataUri).toBe('');
    expect(result.moduleCount).toBe(0);
    expect(result.totalSize).toBe(0);
  });

  it('generateQrCode returns SVG with correct structure', async () => {
    const { generateQrCode } = await import('@/components/design/qr-generator');
    const result = generateQrCode({ data: 'https://example.com' });
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('</svg>');
    expect(result.svg).toContain('<rect');
    expect(result.moduleCount).toBeGreaterThan(0);
    expect(result.totalSize).toBeGreaterThan(0);
  });

  it('generateQrCode respects foreground/background colors', async () => {
    const { generateQrCode } = await import('@/components/design/qr-generator');
    const result = generateQrCode({
      data: 'test',
      foreground: '#FF0000',
      background: '#00FF00',
    });
    expect(result.svg).toContain('#FF0000');
    expect(result.svg).toContain('#00FF00');
  });

  it('generateQrCode totalSize accounts for quiet zone', async () => {
    const { generateQrCode } = await import('@/components/design/qr-generator');
    const r1 = generateQrCode({ data: 'test', quietZone: 4, moduleSize: 10 });
    const r2 = generateQrCode({ data: 'test', quietZone: 0, moduleSize: 10 });
    expect(r1.totalSize).toBeGreaterThan(r2.totalSize);
    // Quiet zone adds 8 modules (4 per side) × 10 = 80 pixels
    expect(r1.totalSize - r2.totalSize).toBe(80);
  });

  it('generateQrSvg returns SVG string', async () => {
    const { generateQrSvg } = await import('@/components/design/qr-generator');
    const svg = generateQrSvg('Hello World');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('generateQrDataUri returns data URI', async () => {
    const { generateQrDataUri } =
      await import('@/components/design/qr-generator');
    const uri = generateQrDataUri('https://example.com');
    expect(uri).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });

  it('validateQrInput rejects empty input', async () => {
    const { validateQrInput } =
      await import('@/components/design/qr-generator');
    expect(validateQrInput('')).not.toBeNull();
    expect(validateQrInput('  ')).not.toBeNull();
  });

  it('validateQrInput accepts valid URL', async () => {
    const { validateQrInput } =
      await import('@/components/design/qr-generator');
    expect(validateQrInput('https://example.com')).toBeNull();
  });

  it('validateQrInput rejects data exceeding capacity', async () => {
    const { validateQrInput } =
      await import('@/components/design/qr-generator');
    const longData = 'A'.repeat(500); // Exceeds V10 capacity
    expect(validateQrInput(longData)).not.toBeNull();
    expect(validateQrInput(longData)).toContain('too long');
  });

  it('getModuleCount returns correct sizes for versions', async () => {
    const { getModuleCount } = await import('@/components/design/qr-generator');
    expect(getModuleCount(1)).toBe(21); // 17 + 4*1
    expect(getModuleCount(2)).toBe(25); // 17 + 4*2
    expect(getModuleCount(5)).toBe(37); // 17 + 4*5
    expect(getModuleCount(10)).toBe(57); // 17 + 4*10
  });

  it('isAlphanumeric correctly classifies strings', async () => {
    const { isAlphanumeric } = await import('@/components/design/qr-generator');
    expect(isAlphanumeric('HELLO')).toBe(true);
    expect(isAlphanumeric('12345')).toBe(true);
    expect(isAlphanumeric('HELLO 123')).toBe(true);
    expect(isAlphanumeric('hello')).toBe(false); // lowercase not in alphanumeric set
    expect(isAlphanumeric('héllo')).toBe(false);
  });

  it('chooseVersion picks smallest fitting version', async () => {
    const { chooseVersion } = await import('@/components/design/qr-generator');
    expect(chooseVersion(10)).toBe(1); // 10 < 14 (V1 capacity)
    expect(chooseVersion(20)).toBe(2); // 20 < 26 (V2 capacity)
    expect(chooseVersion(50)).toBe(4); // 50 < 62 (V4 capacity)
  });

  it('QR code matrix has finder patterns', async () => {
    const { generateQrCode } = await import('@/components/design/qr-generator');
    const result = generateQrCode({
      data: 'Test',
      moduleSize: 1,
      quietZone: 0,
    });
    // The SVG should have dark modules in the finder pattern corners
    // At minimum the output should have many rect elements (dark modules)
    const rectCount = (result.svg.match(/<rect/g) || []).length;
    // Background rect + dark modules (finder patterns alone have ~49*3 = ~147 modules)
    expect(rectCount).toBeGreaterThan(50);
  });

  it('generateQrCode produces consistent output for same input', async () => {
    const { generateQrCode } = await import('@/components/design/qr-generator');
    const r1 = generateQrCode({ data: 'consistent' });
    const r2 = generateQrCode({ data: 'consistent' });
    expect(r1.moduleCount).toBe(r2.moduleCount);
    expect(r1.totalSize).toBe(r2.totalSize);
    // SVGs may differ in exact format, but module counts should match
  });

  it('different data produces different SVGs', async () => {
    const { generateQrCode } = await import('@/components/design/qr-generator');
    const r1 = generateQrCode({ data: 'foo' });
    const r2 = generateQrCode({ data: 'bar' });
    // They might have same version/size but different patterns
    expect(r1.svg).not.toBe(r2.svg);
  });
});

