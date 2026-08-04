// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for redaction-engine.ts — Phase 4
 *
 * Covers createRedactionMark, markAsApplied, annotationToMark,
 * getUnappliedRedactions, getAppliedRedactions, getRedactionMarkStyle,
 * groupRedactionsByPage, hasOverlappingRedaction, mergeOverlappingMarks,
 * validateRedactionBounds, countRedactions
 */

import { describe, it, expect } from 'vitest';
import {
  createRedactionMark,
  markAsApplied,
  annotationToMark,
  getUnappliedRedactions,
  getAppliedRedactions,
  getRedactionMarkStyle,
  groupRedactionsByPage,
  hasOverlappingRedaction,
  mergeOverlappingMarks,
  validateRedactionBounds,
  countRedactions,
} from '@/app/dashboard/tools/pdf-editor/engine/redaction-engine';
import type {
  RedactionAnnotation,
  PageMeta,
} from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Helper ──────────────── */

function makeRedaction(
  overrides: Partial<RedactionAnnotation> = {},
): RedactionAnnotation {
  return {
    id: 'r-1',
    kind: 'redaction',
    page: 1,
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    name: 'Redaction 1',
    fillColor: '#000000',
    applied: false,
    ...overrides,
  };
}

/* ──────────────── Creation ──────────────── */

describe('createRedactionMark', () => {
  it('creates a redaction annotation with correct defaults', () => {
    const mark = createRedactionMark(1, 10, 20, 100, 50);
    expect(mark.kind).toBe('redaction');
    expect(mark.page).toBe(1);
    expect(mark.x).toBe(10);
    expect(mark.y).toBe(20);
    expect(mark.width).toBe(100);
    expect(mark.height).toBe(50);
    expect(mark.applied).toBe(false);
    expect(mark.locked).toBe(false);
    expect(mark.fillColor).toBe('#000000');
    expect(mark.id).toMatch(/^redaction-/);
  });

  it('accepts custom fill color and overlay text', () => {
    const mark = createRedactionMark(2, 0, 0, 50, 30, {
      fillColor: '#FFFFFF',
      overlayText: '[REDACTED]',
    });
    expect(mark.fillColor).toBe('#FFFFFF');
    expect(mark.overlayText).toBe('[REDACTED]');
  });

  it('generates unique IDs', () => {
    const m1 = createRedactionMark(1, 0, 0, 10, 10);
    const m2 = createRedactionMark(1, 0, 0, 10, 10);
    expect(m1.id).not.toBe(m2.id);
  });
});

/* ──────────────── Mark as Applied ──────────────── */

describe('markAsApplied', () => {
  it('sets applied=true and locked=true', () => {
    const original = makeRedaction();
    const applied = markAsApplied(original);
    expect(applied.applied).toBe(true);
    expect(applied.locked).toBe(true);
  });

  it('preserves other properties', () => {
    const original = makeRedaction({ fillColor: '#FF0000' });
    const applied = markAsApplied(original);
    expect(applied.fillColor).toBe('#FF0000');
    expect(applied.kind).toBe('redaction');
    expect(applied.id).toBe(original.id);
  });
});

/* ──────────────── Conversion ──────────────── */

describe('annotationToMark', () => {
  it('extracts position and fill from annotation', () => {
    const annotation = makeRedaction({ overlayText: 'XXXXX' });
    const mark = annotationToMark(annotation);
    expect(mark.id).toBe(annotation.id);
    expect(mark.page).toBe(1);
    expect(mark.x).toBe(10);
    expect(mark.y).toBe(20);
    expect(mark.width).toBe(100);
    expect(mark.height).toBe(50);
    expect(mark.fillColor).toBe('#000000');
    expect(mark.overlayText).toBe('XXXXX');
  });
});

/* ──────────────── Filtering ──────────────── */

describe('getUnappliedRedactions / getAppliedRedactions', () => {
  const annotations: RedactionAnnotation[] = [
    makeRedaction({ id: 'r1', applied: false }),
    makeRedaction({ id: 'r2', applied: true }),
    makeRedaction({ id: 'r3', applied: false }),
  ];

  it('returns only unapplied', () => {
    const unapplied = getUnappliedRedactions(annotations);
    expect(unapplied).toHaveLength(2);
    expect(unapplied.map((a) => a.id)).toEqual(['r1', 'r3']);
  });

  it('returns only applied', () => {
    const applied = getAppliedRedactions(annotations);
    expect(applied).toHaveLength(1);
    expect(applied[0].id).toBe('r2');
  });
});

/* ──────────────── Visual Style ──────────────── */

describe('getRedactionMarkStyle', () => {
  it('returns opaque style for applied marks', () => {
    const style = getRedactionMarkStyle(true);
    expect(style.opacity).toBe(1);
    expect(style.strokeWidth).toBe(0);
    expect(style.strokeDashArray).toEqual([]);
  });

  it('returns semi-transparent dashed style for unapplied marks', () => {
    const style = getRedactionMarkStyle(false);
    expect(style.opacity).toBeLessThan(1);
    expect(style.strokeWidth).toBeGreaterThan(0);
    expect(style.strokeDashArray.length).toBeGreaterThan(0);
  });
});

/* ──────────────── Grouping ──────────────── */

describe('groupRedactionsByPage', () => {
  it('groups marks by page', () => {
    const marks = [
      {
        id: '1',
        page: 1,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fillColor: '#000',
      },
      {
        id: '2',
        page: 2,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fillColor: '#000',
      },
      {
        id: '3',
        page: 1,
        x: 5,
        y: 5,
        width: 10,
        height: 10,
        fillColor: '#000',
      },
    ];
    const grouped = groupRedactionsByPage(marks);
    expect(grouped.get(1)).toHaveLength(2);
    expect(grouped.get(2)).toHaveLength(1);
  });
});

/* ──────────────── Overlap Detection ──────────────── */

describe('hasOverlappingRedaction', () => {
  const marks = [
    {
      id: '1',
      page: 1,
      x: 10,
      y: 10,
      width: 50,
      height: 30,
      fillColor: '#000',
    },
  ];

  it('detects overlap', () => {
    expect(hasOverlappingRedaction(marks, 1, 30, 20, 50, 30)).toBe(true);
  });

  it('returns false for non-overlapping region', () => {
    expect(hasOverlappingRedaction(marks, 1, 200, 200, 10, 10)).toBe(false);
  });

  it('returns false for different page', () => {
    expect(hasOverlappingRedaction(marks, 2, 10, 10, 50, 30)).toBe(false);
  });
});

/* ──────────────── Merge Overlapping ──────────────── */

describe('mergeOverlappingMarks', () => {
  it('returns single mark unchanged', () => {
    const marks = [
      {
        id: '1',
        page: 1,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fillColor: '#000',
      },
    ];
    expect(mergeOverlappingMarks(marks)).toHaveLength(1);
  });

  it('merges two overlapping marks into one', () => {
    const marks = [
      {
        id: '1',
        page: 1,
        x: 0,
        y: 0,
        width: 20,
        height: 20,
        fillColor: '#000',
      },
      {
        id: '2',
        page: 1,
        x: 10,
        y: 10,
        width: 20,
        height: 20,
        fillColor: '#000',
      },
    ];
    const merged = mergeOverlappingMarks(marks);
    expect(merged).toHaveLength(1);
    expect(merged[0].x).toBe(0);
    expect(merged[0].y).toBe(0);
    expect(merged[0].width).toBe(30);
    expect(merged[0].height).toBe(30);
  });

  it('does not merge non-overlapping marks', () => {
    const marks = [
      {
        id: '1',
        page: 1,
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        fillColor: '#000',
      },
      {
        id: '2',
        page: 1,
        x: 100,
        y: 100,
        width: 10,
        height: 10,
        fillColor: '#000',
      },
    ];
    expect(mergeOverlappingMarks(marks)).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(mergeOverlappingMarks([])).toHaveLength(0);
  });
});

/* ──────────────── Bounds Validation ──────────────── */

describe('validateRedactionBounds', () => {
  const pageMeta: PageMeta = {
    width: 612,
    height: 792,
    rotation: 0,
    originalWidth: 612,
    originalHeight: 792,
  };

  it('returns valid for in-bounds mark', () => {
    const mark = {
      id: '1',
      page: 1,
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      fillColor: '#000',
    };
    const result = validateRedactionBounds(mark, pageMeta);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('reports negative coordinates', () => {
    const mark = {
      id: '1',
      page: 1,
      x: -5,
      y: -3,
      width: 10,
      height: 10,
      fillColor: '#000',
    };
    const result = validateRedactionBounds(mark, pageMeta);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it('reports mark extending beyond page', () => {
    const mark = {
      id: '1',
      page: 1,
      x: 600,
      y: 780,
      width: 50,
      height: 50,
      fillColor: '#000',
    };
    const result = validateRedactionBounds(mark, pageMeta);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('width'))).toBe(true);
    expect(result.errors.some((e) => e.includes('height'))).toBe(true);
  });

  it('reports zero-size mark', () => {
    const mark = {
      id: '1',
      page: 1,
      x: 10,
      y: 10,
      width: 0,
      height: 0,
      fillColor: '#000',
    };
    const result = validateRedactionBounds(mark, pageMeta);
    expect(result.valid).toBe(false);
  });
});

/* ──────────────── Count ──────────────── */

describe('countRedactions', () => {
  it('counts applied and unapplied separately', () => {
    const annotations: RedactionAnnotation[] = [
      makeRedaction({ id: 'r1', applied: false }),
      makeRedaction({ id: 'r2', applied: true }),
      makeRedaction({ id: 'r3', applied: true }),
    ];
    const counts = countRedactions(annotations);
    expect(counts.total).toBe(3);
    expect(counts.unapplied).toBe(1);
    expect(counts.applied).toBe(2);
  });

  it('handles empty array', () => {
    const counts = countRedactions([]);
    expect(counts.total).toBe(0);
    expect(counts.unapplied).toBe(0);
    expect(counts.applied).toBe(0);
  });
});
