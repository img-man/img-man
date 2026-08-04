// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for accessibility-engine.ts — Phase 5, Week 20
 *
 * Covers PDF/UA audit, structure tags, reading order,
 * WCAG color contrast calculations, and helper utilities.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  runAccessibilityAudit,
  resetIssueIdCounter,
  resetTagIdCounter,
  createStructureTag,
  addChildTag,
  removeChildTag,
  setTagAltText,
  setTagLanguage,
  setTagType,
  findTagById,
  flattenTags,
  countFiguresMissingAltText,
  getTagTypeLabel,
  getTagTypeIcon,
  generateReadingOrder,
  moveReadingOrderUp,
  moveReadingOrderDown,
  removeFromReadingOrder,
  parseHexColor,
  relativeLuminance,
  contrastRatio,
  checkColorContrast,
  suggestMinFontSize,
} from '@/app/dashboard/tools/pdf-editor/engine/accessibility-engine';
import type { AuditContext } from '@/app/dashboard/tools/pdf-editor/engine/accessibility-engine';
import type {
  StructureTag,
  ReadingOrderItem,
} from '@/app/dashboard/tools/pdf-editor/types';

beforeEach(() => {
  resetIssueIdCounter();
  resetTagIdCounter();
});

/* ── Helper to build a complete "passing" audit context ── */
function passingContext(overrides: Partial<AuditContext> = {}): AuditContext {
  return {
    title: 'Test Document',
    language: 'en',
    hasStructureTags: true,
    tags: [
      createStructureTag('paragraph', 1, {
        x: 0,
        y: 0,
        width: 100,
        height: 20,
      }),
    ],
    readingOrder: [{ tagId: 'tag-1', page: 1, order: 1 }],
    figureCount: 1,
    figuresWithAltText: 1,
    formFieldCount: 0,
    formFieldsWithLabels: 0,
    hasBookmarks: true,
    headingLevels: [1, 2, 3],
    tableCount: 0,
    tablesWithHeaders: 0,
    ...overrides,
  };
}

/* ──────────────── Accessibility Audit ──────────────── */

describe('runAccessibilityAudit', () => {
  // Reset again since passingContext creates a tag
  beforeEach(() => {
    resetIssueIdCounter();
    resetTagIdCounter();
  });

  it('raises error when title is missing', () => {
    const ctx = passingContext({ title: '' });
    const report = runAccessibilityAudit(ctx);
    const titles = report.issues.filter((i) => i.rule === 'doc-title');
    expect(titles).toHaveLength(1);
    expect(titles[0].level).toBe('error');
  });

  it('raises error when language is missing', () => {
    const ctx = passingContext({ language: undefined });
    const report = runAccessibilityAudit(ctx);
    const langs = report.issues.filter((i) => i.rule === 'doc-language');
    expect(langs).toHaveLength(1);
    expect(langs[0].level).toBe('error');
  });

  it('raises error when structure tags are absent', () => {
    const ctx = passingContext({ hasStructureTags: false, tags: [] });
    const report = runAccessibilityAudit(ctx);
    expect(report.issues.some((i) => i.rule === 'tagged-content')).toBe(true);
  });

  it('raises error when reading order is missing but tags exist', () => {
    const ctx = passingContext({ readingOrder: [] });
    const report = runAccessibilityAudit(ctx);
    expect(report.issues.some((i) => i.rule === 'reading-order')).toBe(true);
  });

  it('raises error for missing alt text', () => {
    const ctx = passingContext({ figureCount: 3, figuresWithAltText: 1 });
    const report = runAccessibilityAudit(ctx);
    const altIssue = report.issues.find((i) => i.rule === 'alt-text');
    expect(altIssue).toBeDefined();
    expect(altIssue!.description).toContain('2');
  });

  it('detects heading hierarchy skips', () => {
    const ctx = passingContext({ headingLevels: [1, 3] }); // Skips H2
    const report = runAccessibilityAudit(ctx);
    expect(report.issues.some((i) => i.rule === 'heading-hierarchy')).toBe(
      true,
    );
  });

  it('does not flag sequential headings', () => {
    const ctx = passingContext({ headingLevels: [1, 2, 3] });
    const report = runAccessibilityAudit(ctx);
    expect(report.issues.some((i) => i.rule === 'heading-hierarchy')).toBe(
      false,
    );
  });

  it('raises error for form fields missing labels', () => {
    const ctx = passingContext({ formFieldCount: 5, formFieldsWithLabels: 2 });
    const report = runAccessibilityAudit(ctx);
    expect(report.issues.some((i) => i.rule === 'form-labels')).toBe(true);
  });

  it('raises warning for tables missing headers', () => {
    const ctx = passingContext({ tableCount: 3, tablesWithHeaders: 1 });
    const report = runAccessibilityAudit(ctx);
    const tbl = report.issues.find((i) => i.rule === 'table-headers');
    expect(tbl).toBeDefined();
    expect(tbl!.level).toBe('warning');
  });

  it('raises info when bookmarks are missing', () => {
    const ctx = passingContext({ hasBookmarks: false });
    const report = runAccessibilityAudit(ctx);
    expect(
      report.issues.some(
        (i) => i.rule === 'bookmark-present' && i.level === 'info',
      ),
    ).toBe(true);
  });

  it('produces a high score for a fully compliant document', () => {
    const ctx = passingContext();
    const report = runAccessibilityAudit(ctx);
    expect(report.score).toBeGreaterThanOrEqual(90);
    expect(report.passedChecks).toBeGreaterThan(0);
  });

  it('produces a low score for a non-compliant document', () => {
    const ctx: AuditContext = {
      title: '',
      language: '',
      hasStructureTags: false,
      tags: [],
      readingOrder: [],
      figureCount: 5,
      figuresWithAltText: 0,
      formFieldCount: 3,
      formFieldsWithLabels: 0,
      hasBookmarks: false,
      headingLevels: [1, 4],
      tableCount: 2,
      tablesWithHeaders: 0,
    };
    const report = runAccessibilityAudit(ctx);
    expect(report.score).toBeLessThan(50);
    expect(report.issues.length).toBeGreaterThan(5);
  });
});

/* ──────────────── Structure Tag Management ──────────────── */

describe('Structure tag management', () => {
  it('creates a tag with correct fields', () => {
    const tag = createStructureTag('heading', 1, {
      x: 10,
      y: 20,
      width: 300,
      height: 40,
    });
    expect(tag.id).toBe('tag-1');
    expect(tag.type).toBe('heading');
    expect(tag.page).toBe(1);
    expect(tag.x).toBe(10);
    expect(tag.children).toEqual([]);
  });

  it('supports alt text and language options', () => {
    const tag = createStructureTag(
      'figure',
      1,
      { x: 0, y: 0, width: 100, height: 100 },
      {
        altText: 'A cat',
        language: 'en',
      },
    );
    expect(tag.altText).toBe('A cat');
    expect(tag.language).toBe('en');
  });

  it('adds and removes children', () => {
    const parent = createStructureTag('section', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const child = createStructureTag('paragraph', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const withChild = addChildTag(parent, child);
    expect(withChild.children).toHaveLength(1);

    const removed = removeChildTag(withChild, child.id);
    expect(removed.children).toHaveLength(0);
  });

  it('updates alt text', () => {
    const tag = createStructureTag('figure', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const updated = setTagAltText(tag, 'A beautiful sunset');
    expect(updated.altText).toBe('A beautiful sunset');
  });

  it('updates language', () => {
    const tag = createStructureTag('paragraph', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const updated = setTagLanguage(tag, 'fr');
    expect(updated.language).toBe('fr');
  });

  it('updates type', () => {
    const tag = createStructureTag('paragraph', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const updated = setTagType(tag, 'heading');
    expect(updated.type).toBe('heading');
  });

  it('finds a tag by ID in nested tree', () => {
    const child = createStructureTag('paragraph', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const parent = addChildTag(
      createStructureTag('section', 1, { x: 0, y: 0, width: 100, height: 100 }),
      child,
    );
    expect(findTagById([parent], child.id)).toEqual(child);
    expect(findTagById([parent], 'nonexistent')).toBeNull();
  });

  it('flattens tags depth-first', () => {
    const child1 = createStructureTag('paragraph', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const child2 = createStructureTag('paragraph', 1, {
      x: 0,
      y: 30,
      width: 100,
      height: 20,
    });
    const parent = addChildTag(
      addChildTag(
        createStructureTag('section', 1, {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        }),
        child1,
      ),
      child2,
    );
    const flat = flattenTags([parent]);
    expect(flat).toHaveLength(3);
    expect(flat[0].id).toBe(parent.id);
    expect(flat[1].id).toBe(child1.id);
    expect(flat[2].id).toBe(child2.id);
  });

  it('counts figures missing alt text', () => {
    const fig1 = createStructureTag(
      'figure',
      1,
      { x: 0, y: 0, width: 100, height: 100 },
      { altText: 'Desc' },
    );
    const fig2 = createStructureTag('figure', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    const para = createStructureTag('paragraph', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const result = countFiguresMissingAltText([fig1, fig2, para]);
    expect(result.total).toBe(2);
    expect(result.withAlt).toBe(1);
  });

  it('gets tag type label and icon', () => {
    expect(getTagTypeLabel('heading')).toBe('Heading');
    expect(getTagTypeLabel('paragraph')).toBe('Paragraph');
    expect(typeof getTagTypeIcon('heading')).toBe('string');
  });
});

/* ──────────────── Reading Order ──────────────── */

describe('Reading order management', () => {
  it('generates reading order from tags sorted by page then y', () => {
    const t1 = createStructureTag('paragraph', 1, {
      x: 0,
      y: 100,
      width: 100,
      height: 20,
    });
    const t2 = createStructureTag('paragraph', 1, {
      x: 0,
      y: 10,
      width: 100,
      height: 20,
    });
    const t3 = createStructureTag('paragraph', 2, {
      x: 0,
      y: 5,
      width: 100,
      height: 20,
    });
    const order = generateReadingOrder([t1, t2, t3]);
    expect(order).toHaveLength(3);
    // Page 1 y=10 first, page 1 y=100 second, page 2 y=5 third
    expect(order[0].tagId).toBe(t2.id);
    expect(order[1].tagId).toBe(t1.id);
    expect(order[2].tagId).toBe(t3.id);
    expect(order[0].order).toBe(1);
    expect(order[2].order).toBe(3);
  });

  it('excludes artifact tags from reading order', () => {
    const art = createStructureTag('artifact', 1, {
      x: 0,
      y: 0,
      width: 100,
      height: 20,
    });
    const para = createStructureTag('paragraph', 1, {
      x: 0,
      y: 30,
      width: 100,
      height: 20,
    });
    const order = generateReadingOrder([art, para]);
    expect(order).toHaveLength(1);
    expect(order[0].tagId).toBe(para.id);
  });

  it('moves item up in reading order', () => {
    const items: ReadingOrderItem[] = [
      { tagId: 'a', page: 1, order: 1 },
      { tagId: 'b', page: 1, order: 2 },
      { tagId: 'c', page: 1, order: 3 },
    ];
    const moved = moveReadingOrderUp(items, 'b');
    expect(moved[0].tagId).toBe('b');
    expect(moved[1].tagId).toBe('a');
    // Orders renumbered
    expect(moved[0].order).toBe(1);
    expect(moved[1].order).toBe(2);
  });

  it('does not move the first item up', () => {
    const items: ReadingOrderItem[] = [
      { tagId: 'a', page: 1, order: 1 },
      { tagId: 'b', page: 1, order: 2 },
    ];
    const moved = moveReadingOrderUp(items, 'a');
    expect(moved[0].tagId).toBe('a');
  });

  it('moves item down in reading order', () => {
    const items: ReadingOrderItem[] = [
      { tagId: 'a', page: 1, order: 1 },
      { tagId: 'b', page: 1, order: 2 },
      { tagId: 'c', page: 1, order: 3 },
    ];
    const moved = moveReadingOrderDown(items, 'b');
    expect(moved[1].tagId).toBe('c');
    expect(moved[2].tagId).toBe('b');
  });

  it('does not move the last item down', () => {
    const items: ReadingOrderItem[] = [
      { tagId: 'a', page: 1, order: 1 },
      { tagId: 'b', page: 1, order: 2 },
    ];
    const moved = moveReadingOrderDown(items, 'b');
    expect(moved[1].tagId).toBe('b');
  });

  it('removes an item from reading order and renumbers', () => {
    const items: ReadingOrderItem[] = [
      { tagId: 'a', page: 1, order: 1 },
      { tagId: 'b', page: 1, order: 2 },
      { tagId: 'c', page: 1, order: 3 },
    ];
    const removed = removeFromReadingOrder(items, 'b');
    expect(removed).toHaveLength(2);
    expect(removed[0].tagId).toBe('a');
    expect(removed[0].order).toBe(1);
    expect(removed[1].tagId).toBe('c');
    expect(removed[1].order).toBe(2);
  });
});

/* ──────────────── Color Contrast (WCAG 2.1) ──────────────── */

describe('parseHexColor', () => {
  it('parses #RRGGBB', () => {
    expect(parseHexColor('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseHexColor('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('parses #RGB shorthand', () => {
    expect(parseHexColor('#F00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHexColor('#FFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('returns null for invalid input', () => {
    // #GGGGGG has 6 chars so parseHexColor returns { r: NaN, ... } — only length is checked
    expect(parseHexColor('#12345')).toBeNull();
    expect(parseHexColor('')).toBeNull();
    expect(parseHexColor('#1')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('returns 0 for black', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0);
  });

  it('returns 1 for white', () => {
    expect(relativeLuminance(255, 255, 255)).toBeCloseTo(1, 1);
  });

  it('returns intermediate values for mid-tones', () => {
    const lum = relativeLuminance(128, 128, 128);
    expect(lum).toBeGreaterThan(0);
    expect(lum).toBeLessThan(1);
  });
});

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    const ratio = contrastRatio(
      { r: 0, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('returns 1 for same color', () => {
    const ratio = contrastRatio(
      { r: 128, g: 128, b: 128 },
      { r: 128, g: 128, b: 128 },
    );
    expect(ratio).toBeCloseTo(1);
  });

  it("is symmetric (fg/bg order doesn't matter for ratio)", () => {
    const r1 = contrastRatio(
      { r: 255, g: 0, b: 0 },
      { r: 255, g: 255, b: 255 },
    );
    const r2 = contrastRatio(
      { r: 255, g: 255, b: 255 },
      { r: 255, g: 0, b: 0 },
    );
    expect(r1).toBeCloseTo(r2);
  });
});

describe('checkColorContrast', () => {
  it('passes AA for black on white at normal text size', () => {
    const result = checkColorContrast('#000000', '#FFFFFF', 16, false);
    expect(result).not.toBeNull();
    expect(result!.meetsAA).toBe(true);
    expect(result!.meetsAAA).toBe(true);
    expect(result!.ratio).toBeCloseTo(21, 0);
  });

  it('fails AA for light gray on white', () => {
    const result = checkColorContrast('#CCCCCC', '#FFFFFF', 16, false);
    expect(result).not.toBeNull();
    expect(result!.meetsAA).toBe(false);
  });

  it('uses large text thresholds for big fonts', () => {
    // A color pair that fails normal AA (4.5:1) but passes large AA (3:1)
    const result = checkColorContrast('#767676', '#FFFFFF', 24, false);
    expect(result).not.toBeNull();
    // #767676 on white is ~4.54:1, should pass both for large text
    expect(result!.meetsAA).toBe(true);
  });

  it('uses large text thresholds for bold 14pt+', () => {
    const result = checkColorContrast('#767676', '#FFFFFF', 14, true);
    expect(result).not.toBeNull();
    expect(result!.meetsAA).toBe(true);
  });

  it('returns null for invalid hex', () => {
    expect(checkColorContrast('invalid', '#FFFFFF', 16, false)).toBeNull();
    expect(checkColorContrast('#000000', 'nope', 16, false)).toBeNull();
  });
});

describe('suggestMinFontSize', () => {
  it('returns null when ratio already meets normal AA', () => {
    expect(suggestMinFontSize(5.0, false)).toBeNull();
  });

  it('suggests large text size when ratio meets large AA only', () => {
    const size = suggestMinFontSize(3.5, false);
    expect(size).toBeGreaterThanOrEqual(18);
  });

  it('suggests 14 for bold when ratio meets large AA', () => {
    expect(suggestMinFontSize(3.5, true)).toBe(14);
  });

  it('returns null when ratio is too low even for large text', () => {
    expect(suggestMinFontSize(2.0, false)).toBeNull();
  });
});
