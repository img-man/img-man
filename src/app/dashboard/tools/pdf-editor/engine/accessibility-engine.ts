// SPDX-License-Identifier: Apache-2.0
/**
 * Accessibility Engine — Phase 5, Week 20
 *
 * Provides:
 * - PDF/UA compliance audit (rule-based checker)
 * - Structure tag tree management
 * - Reading order editor helpers
 * - Color contrast calculation (WCAG 2.1 AA/AAA)
 * - Alt text management for figures
 * - Accessibility score computation
 */

import type {
  AccessibilityIssue,
  AccessibilityIssueLevel,
  AccessibilityReport,
  StructureTag,
  StructureTagType,
  ReadingOrderItem,
  ColorContrastResult,
} from '../types';
import {
  ACCESSIBILITY_RULES,
  STRUCTURE_TAG_TYPES,
  WCAG_AA_RATIO_NORMAL,
  WCAG_AA_RATIO_LARGE,
  WCAG_AAA_RATIO_NORMAL,
  WCAG_AAA_RATIO_LARGE,
  LARGE_TEXT_THRESHOLD,
} from '../constants';

/* ══════════════════════════════════════════════════════════════════════════
   Accessibility audit
   ══════════════════════════════════════════════════════════════════════════ */

export interface AuditContext {
  title?: string;
  language?: string;
  hasStructureTags: boolean;
  tags: StructureTag[];
  readingOrder: ReadingOrderItem[];
  figureCount: number;
  figuresWithAltText: number;
  formFieldCount: number;
  formFieldsWithLabels: number;
  hasBookmarks: boolean;
  headingLevels: number[];
  tableCount: number;
  tablesWithHeaders: number;
}

let nextIssueId = 1;

/** Reset issue ID counter (for testing). */
export function resetIssueIdCounter(): void {
  nextIssueId = 1;
}

/**
 * Run a full PDF/UA accessibility audit against the provided context.
 * Returns an AccessibilityReport with issues and a score.
 */
export function runAccessibilityAudit(
  context: AuditContext,
): AccessibilityReport {
  const issues: AccessibilityIssue[] = [];

  // doc-title
  if (!context.title || context.title.trim().length === 0) {
    issues.push(
      createIssue(
        'error',
        'doc-title',
        'Document is missing a title',
        'Add a descriptive document title in metadata',
      ),
    );
  }

  // doc-language
  if (!context.language || context.language.trim().length === 0) {
    issues.push(
      createIssue(
        'error',
        'doc-language',
        'Document language is not set',
        'Set the document language (e.g., "en") in metadata',
      ),
    );
  }

  // tagged-content
  if (!context.hasStructureTags || context.tags.length === 0) {
    issues.push(
      createIssue(
        'error',
        'tagged-content',
        'Document has no structure tags',
        'Add structure tags to all content using the tag editor',
      ),
    );
  }

  // reading-order
  if (context.hasStructureTags && context.readingOrder.length === 0) {
    issues.push(
      createIssue(
        'error',
        'reading-order',
        'Reading order is not defined',
        'Define reading order for all tagged content',
      ),
    );
  }

  // alt-text
  if (
    context.figureCount > 0 &&
    context.figuresWithAltText < context.figureCount
  ) {
    const missing = context.figureCount - context.figuresWithAltText;
    issues.push(
      createIssue(
        'error',
        'alt-text',
        `${missing} figure(s) missing alternative text`,
        'Add descriptive alt text to all figures',
      ),
    );
  }

  // heading-hierarchy
  if (context.headingLevels.length > 0) {
    const sorted = [...new Set(context.headingLevels)].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 1) {
        issues.push(
          createIssue(
            'warning',
            'heading-hierarchy',
            `Heading hierarchy skips from H${sorted[i - 1]} to H${sorted[i]}`,
            'Ensure heading levels increase sequentially (H1 → H2 → H3)',
          ),
        );
        break;
      }
    }
  }

  // color-contrast — checked separately via calculateColorContrast

  // form-labels
  if (
    context.formFieldCount > 0 &&
    context.formFieldsWithLabels < context.formFieldCount
  ) {
    const missing = context.formFieldCount - context.formFieldsWithLabels;
    issues.push(
      createIssue(
        'error',
        'form-labels',
        `${missing} form field(s) missing labels`,
        'Add descriptive labels to all form fields',
      ),
    );
  }

  // tab-order (check if form fields exist but reading order doesn't cover them)
  if (context.formFieldCount > 0 && context.readingOrder.length === 0) {
    issues.push(
      createIssue(
        'warning',
        'tab-order',
        'Form fields have no defined tab order',
        'Define tab order via the reading order editor',
      ),
    );
  }

  // table-headers
  if (
    context.tableCount > 0 &&
    context.tablesWithHeaders < context.tableCount
  ) {
    const missing = context.tableCount - context.tablesWithHeaders;
    issues.push(
      createIssue(
        'warning',
        'table-headers',
        `${missing} table(s) missing header cells`,
        'Mark first row or column as table headers',
      ),
    );
  }

  // bookmark-present
  if (!context.hasBookmarks) {
    issues.push(
      createIssue(
        'info',
        'bookmark-present',
        'Document has no bookmarks',
        'Add bookmarks for easy navigation',
      ),
    );
  }

  // artifact-marking — would need decorative element detection (info level)
  // Skipped for now as it requires image analysis

  return buildReport(issues);
}

/** Create a single issue. */
function createIssue(
  level: AccessibilityIssueLevel,
  rule: string,
  description: string,
  suggestion: string,
  page?: number,
  element?: string,
): AccessibilityIssue {
  return {
    id: `a11y-${nextIssueId++}`,
    level,
    rule,
    description,
    page,
    element,
    suggestion,
  };
}

/** Build the final report from the issues list. */
function buildReport(issues: AccessibilityIssue[]): AccessibilityReport {
  const totalChecks = ACCESSIBILITY_RULES.length;
  const failedRules = new Set(issues.map((i) => i.rule));
  const passedChecks = totalChecks - failedRules.size;

  // Score: weight errors heavily, warnings medium, info lightly
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warningCount = issues.filter((i) => i.level === 'warning').length;
  const infoCount = issues.filter((i) => i.level === 'info').length;

  const deductions = errorCount * 15 + warningCount * 8 + infoCount * 2;
  const score = Math.max(0, Math.min(100, 100 - deductions));

  return {
    issues,
    score,
    passedChecks,
    totalChecks,
    generatedAt: new Date(),
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   Structure tag management
   ══════════════════════════════════════════════════════════════════════════ */

let nextTagId = 1;

/** Reset tag ID counter (for testing). */
export function resetTagIdCounter(): void {
  nextTagId = 1;
}

/** Create a new structure tag. */
export function createStructureTag(
  type: StructureTagType,
  page: number,
  bounds: { x: number; y: number; width: number; height: number },
  options?: { altText?: string; language?: string; order?: number },
): StructureTag {
  return {
    id: `tag-${nextTagId++}`,
    type,
    page,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    altText: options?.altText,
    language: options?.language,
    children: [],
    order: options?.order ?? 0,
  };
}

/** Add a child tag to a parent tag (returns a new parent). */
export function addChildTag(
  parent: StructureTag,
  child: StructureTag,
): StructureTag {
  return { ...parent, children: [...parent.children, child] };
}

/** Remove a child tag by ID (shallow — only immediate children). */
export function removeChildTag(
  parent: StructureTag,
  childId: string,
): StructureTag {
  return {
    ...parent,
    children: parent.children.filter((c) => c.id !== childId),
  };
}

/** Update a tag's alt text. */
export function setTagAltText(
  tag: StructureTag,
  altText: string,
): StructureTag {
  return { ...tag, altText };
}

/** Update a tag's language. */
export function setTagLanguage(
  tag: StructureTag,
  language: string,
): StructureTag {
  return { ...tag, language };
}

/** Update a tag's type. */
export function setTagType(
  tag: StructureTag,
  type: StructureTagType,
): StructureTag {
  return { ...tag, type };
}

/** Find a tag by ID in a tree (depth-first). */
export function findTagById(
  tags: StructureTag[],
  id: string,
): StructureTag | null {
  for (const tag of tags) {
    if (tag.id === id) return tag;
    const found = findTagById(tag.children, id);
    if (found) return found;
  }
  return null;
}

/** Flatten a tag tree into a flat array (depth-first). */
export function flattenTags(tags: StructureTag[]): StructureTag[] {
  const result: StructureTag[] = [];
  for (const tag of tags) {
    result.push(tag);
    result.push(...flattenTags(tag.children));
  }
  return result;
}

/** Count figures missing alt text. */
export function countFiguresMissingAltText(tags: StructureTag[]): {
  total: number;
  withAlt: number;
} {
  const flat = flattenTags(tags);
  const figures = flat.filter((t) => t.type === 'figure');
  const withAlt = figures.filter(
    (f) => f.altText && f.altText.trim().length > 0,
  );
  return { total: figures.length, withAlt: withAlt.length };
}

/** Get a tag type's label. */
export function getTagTypeLabel(type: StructureTagType): string {
  const entry = STRUCTURE_TAG_TYPES.find((t) => t.value === type);
  return entry?.label ?? type;
}

/** Get a tag type's icon. */
export function getTagTypeIcon(type: StructureTagType): string {
  const entry = STRUCTURE_TAG_TYPES.find((t) => t.value === type);
  return entry?.icon ?? '?';
}

/* ══════════════════════════════════════════════════════════════════════════
   Reading order management
   ══════════════════════════════════════════════════════════════════════════ */

/** Create a reading order from structure tags (simple: by page then y-position). */
export function generateReadingOrder(tags: StructureTag[]): ReadingOrderItem[] {
  const flat = flattenTags(tags).filter(
    (t) => t.type !== 'artifact', // Artifacts are not read
  );

  const sorted = [...flat].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.y - b.y;
  });

  return sorted.map((tag, idx) => ({
    tagId: tag.id,
    page: tag.page,
    order: idx + 1,
  }));
}

/** Move an item up in the reading order. */
export function moveReadingOrderUp(
  order: ReadingOrderItem[],
  tagId: string,
): ReadingOrderItem[] {
  const idx = order.findIndex((o) => o.tagId === tagId);
  if (idx <= 0) return order;

  const newOrder = [...order];
  [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
  return renumber(newOrder);
}

/** Move an item down in the reading order. */
export function moveReadingOrderDown(
  order: ReadingOrderItem[],
  tagId: string,
): ReadingOrderItem[] {
  const idx = order.findIndex((o) => o.tagId === tagId);
  if (idx < 0 || idx >= order.length - 1) return order;

  const newOrder = [...order];
  [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
  return renumber(newOrder);
}

/** Remove an item from the reading order. */
export function removeFromReadingOrder(
  order: ReadingOrderItem[],
  tagId: string,
): ReadingOrderItem[] {
  return renumber(order.filter((o) => o.tagId !== tagId));
}

function renumber(order: ReadingOrderItem[]): ReadingOrderItem[] {
  return order.map((item, idx) => ({ ...item, order: idx + 1 }));
}

/* ══════════════════════════════════════════════════════════════════════════
   Color contrast (WCAG 2.1)
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse a hex color string to RGB values.
 * Supports #RGB, #RRGGBB formats.
 */
export function parseHexColor(
  hex: string,
): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }
  if (cleaned.length === 6) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * Calculate relative luminance of a color per WCAG 2.1.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate the contrast ratio between two colors.
 * Returns a value between 1 (no contrast) and 21 (maximum).
 */
export function contrastRatio(
  fg: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
): number {
  const l1 = relativeLuminance(fg.r, fg.g, fg.b);
  const l2 = relativeLuminance(bg.r, bg.g, bg.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check WCAG contrast for a foreground/background pair.
 * Returns a full ColorContrastResult.
 */
export function checkColorContrast(
  foreground: string,
  background: string,
  fontSize: number,
  isBold: boolean,
): ColorContrastResult | null {
  const fg = parseHexColor(foreground);
  const bg = parseHexColor(background);
  if (!fg || !bg) return null;

  const ratio = contrastRatio(fg, bg);
  const isLarge =
    fontSize >= LARGE_TEXT_THRESHOLD || (isBold && fontSize >= 14);

  const aaThreshold = isLarge ? WCAG_AA_RATIO_LARGE : WCAG_AA_RATIO_NORMAL;
  const aaaThreshold = isLarge ? WCAG_AAA_RATIO_LARGE : WCAG_AAA_RATIO_NORMAL;

  return {
    foreground,
    background,
    ratio: Math.round(ratio * 100) / 100,
    meetsAA: ratio >= aaThreshold,
    meetsAAA: ratio >= aaaThreshold,
    fontSize,
    isBold,
  };
}

/**
 * Suggest a minimum font size that would meet AA contrast for a given ratio.
 */
export function suggestMinFontSize(
  ratio: number,
  isBold: boolean,
): number | null {
  if (ratio >= WCAG_AA_RATIO_NORMAL) return null; // Already meets for any size
  if (ratio >= WCAG_AA_RATIO_LARGE) return isBold ? 14 : LARGE_TEXT_THRESHOLD;
  return null; // Can't meet even with large text
}
