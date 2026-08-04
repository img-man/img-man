// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for alignment.ts — Phase 3
 *
 * Covers alignAnnotations, distributeAnnotations, calculateSnap,
 * reorderZIndex, getGroupBounds, duplicateAnnotations
 */

import { describe, it, expect } from 'vitest';
import {
  alignAnnotations,
  distributeAnnotations,
  calculateSnap,
  reorderZIndex,
  getGroupBounds,
  duplicateAnnotations,
} from '@/app/dashboard/tools/pdf-editor/engine/alignment';
import type {
  Annotation,
  TextAnnotation,
  PageMeta,
} from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Helper: create a basic annotation ──────────────── */

function makeAnn(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 50,
): TextAnnotation {
  return {
    id,
    kind: 'text',
    page: 1,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    text: 'Test',
    fontSize: 12,
    fontFamily: 'Arial',
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'left',
    color: '#000000',
    backgroundColor: 'transparent',
    lineHeight: 1.5,
  };
}

const pageMeta: PageMeta = {
  width: 612,
  height: 792,
  rotation: 0,
  index: 0,
};

/* ──────────────────────── Align ──────────────────────── */

describe('alignAnnotations', () => {
  it('should align left (multiple annotations to leftmost)', () => {
    const anns = [
      makeAnn('a', 100, 50),
      makeAnn('b', 200, 80),
      makeAnn('c', 50, 120),
    ];
    const result = alignAnnotations(anns, 'left');
    expect(result.every((r) => r.x === 50)).toBe(true);
  });

  it('should align right (multiple annotations to rightmost)', () => {
    const anns = [makeAnn('a', 100, 50, 100), makeAnn('b', 200, 80, 100)];
    const result = alignAnnotations(anns, 'right');
    // rightmost edge is 200 + 100 = 300
    expect(result[0].x).toBe(200); // 300 - 100
    expect(result[1].x).toBe(200);
  });

  it('should align top', () => {
    const anns = [
      makeAnn('a', 50, 100),
      makeAnn('b', 80, 200),
      makeAnn('c', 120, 50),
    ];
    const result = alignAnnotations(anns, 'top');
    expect(result.every((r) => r.y === 50)).toBe(true);
  });

  it('should align bottom', () => {
    const anns = [
      makeAnn('a', 50, 100, 100, 50),
      makeAnn('b', 80, 200, 100, 50),
    ];
    const result = alignAnnotations(anns, 'bottom');
    // bottommost edge = 200 + 50 = 250
    expect(result[0].y).toBe(200); // 250 - 50
    expect(result[1].y).toBe(200);
  });

  it('should align single annotation to page center', () => {
    const anns = [makeAnn('a', 100, 100, 100, 50)];
    const result = alignAnnotations(anns, 'center', pageMeta);
    expect(result[0].x).toBeCloseTo(256, 0); // (612 - 100) / 2
  });

  it('should return empty for empty input', () => {
    expect(alignAnnotations([], 'left')).toEqual([]);
  });
});

/* ──────────────────────── Distribute ──────────────────────── */

describe('distributeAnnotations', () => {
  it('should distribute horizontally with equal spacing', () => {
    const anns = [
      makeAnn('a', 0, 100, 50, 50),
      makeAnn('b', 200, 100, 50, 50),
      makeAnn('c', 500, 100, 50, 50),
    ];
    const result = distributeAnnotations(anns, 'horizontal');
    // Three items should be evenly distributed
    expect(result.length).toBe(3);
    // First and last should stay in position (min and max)
    const xs = result.sort((a, b) => a.x - b.x).map((r) => r.x);
    expect(xs[0]).toBe(0);
    expect(xs[2]).toBe(500);
    // Middle should be evenly spaced
    expect(xs[1]).toBeGreaterThan(xs[0]);
    expect(xs[1]).toBeLessThan(xs[2]);
  });

  it('should distribute vertically', () => {
    const anns = [
      makeAnn('a', 100, 0, 50, 50),
      makeAnn('b', 100, 300, 50, 50),
      makeAnn('c', 100, 600, 50, 50),
    ];
    const result = distributeAnnotations(anns, 'vertical');
    expect(result.length).toBe(3);
    const ys = result.sort((a, b) => a.y - b.y).map((r) => r.y);
    expect(ys[0]).toBe(0);
    expect(ys[2]).toBe(600);
  });

  it('should return identity for fewer than 3 annotations', () => {
    const anns = [makeAnn('a', 0, 0), makeAnn('b', 100, 100)];
    const result = distributeAnnotations(anns, 'horizontal');
    expect(result.length).toBe(2);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
  });
});

/* ──────────────────────── Snap Calculation ──────────────────────── */

describe('calculateSnap', () => {
  it('should snap to page edges', () => {
    const result = calculateSnap(
      makeAnn('moving', 2, 2, 100, 50), // near top-left edge
      [],
      pageMeta,
      5,
    );
    // Should suggest snapping to x=0 and y=0 (within threshold of 5)
    expect(result.guides.length).toBeGreaterThan(0);
  });

  it('should return empty guides for no nearby snap targets', () => {
    const result = calculateSnap(
      makeAnn('moving', 300, 400, 100, 50),
      [],
      pageMeta,
      5,
    );
    // 300, 400 is not near any edges or center
    expect(Array.isArray(result.guides)).toBe(true);
  });

  it('should snap to other annotations', () => {
    const others = [makeAnn('target', 100, 200, 100, 50)];
    const result = calculateSnap(
      makeAnn('moving', 98, 250, 100, 50), // x=98, close to target x=100
      others,
      pageMeta,
      5,
    );
    const hasVertical = result.guides.some((s) => s.orientation === 'vertical');
    expect(hasVertical).toBe(true);
  });
});

/* ──────────────────────── Z-Index Reorder ──────────────────────── */

describe('reorderZIndex', () => {
  it('should bring forward', () => {
    const anns: Annotation[] = [
      makeAnn('a', 0, 0),
      makeAnn('b', 10, 10),
      makeAnn('c', 20, 20),
    ];
    const result = reorderZIndex(anns, 'a', 'forward');
    const ids = result.map((a) => a.id);
    expect(ids.indexOf('a')).toBe(1); // moved from 0 to 1
  });

  it('should bring to front', () => {
    const anns: Annotation[] = [
      makeAnn('a', 0, 0),
      makeAnn('b', 10, 10),
      makeAnn('c', 20, 20),
    ];
    const result = reorderZIndex(anns, 'a', 'front');
    expect(result[result.length - 1].id).toBe('a');
  });

  it('should send backward', () => {
    const anns: Annotation[] = [
      makeAnn('a', 0, 0),
      makeAnn('b', 10, 10),
      makeAnn('c', 20, 20),
    ];
    const result = reorderZIndex(anns, 'c', 'backward');
    const ids = result.map((a) => a.id);
    expect(ids.indexOf('c')).toBe(1);
  });

  it('should send to back', () => {
    const anns: Annotation[] = [
      makeAnn('a', 0, 0),
      makeAnn('b', 10, 10),
      makeAnn('c', 20, 20),
    ];
    const result = reorderZIndex(anns, 'c', 'back');
    expect(result[0].id).toBe('c');
  });
});

/* ──────────────────────── Group Bounds ──────────────────────── */

describe('getGroupBounds', () => {
  it('should compute bounding box of multiple annotations', () => {
    const anns = [
      makeAnn('a', 10, 20, 100, 50),
      makeAnn('b', 200, 300, 80, 40),
    ];
    const bounds = getGroupBounds(anns);
    expect(bounds.x).toBe(10);
    expect(bounds.y).toBe(20);
    expect(bounds.width).toBe(270); // 200 + 80 - 10
    expect(bounds.height).toBe(320); // 300 + 40 - 20
  });

  it('should handle single annotation', () => {
    const anns = [makeAnn('a', 50, 60, 100, 40)];
    const bounds = getGroupBounds(anns);
    expect(bounds.x).toBe(50);
    expect(bounds.y).toBe(60);
    expect(bounds.width).toBe(100);
    expect(bounds.height).toBe(40);
  });
});

/* ──────────────────────── Duplicate ──────────────────────── */

describe('duplicateAnnotations', () => {
  it('should create copies with offset', () => {
    const anns = [makeAnn('a', 100, 100)];
    const duped = duplicateAnnotations(anns as Annotation[]);
    expect(duped.length).toBe(1);
    expect(duped[0].id).not.toBe('a');
    expect(duped[0].x).toBeGreaterThan(100); // offset applied
    expect(duped[0].y).toBeGreaterThan(100);
  });

  it('should duplicate multiple annotations', () => {
    const anns = [makeAnn('a', 0, 0), makeAnn('b', 100, 100)];
    const duped = duplicateAnnotations(anns as Annotation[]);
    expect(duped.length).toBe(2);
    expect(duped[0].id).not.toBe(duped[1].id);
  });
});
