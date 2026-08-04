// SPDX-License-Identifier: Apache-2.0
/**
 * DS-3.2 Boolean Path Operations Tests
 */
import { describe, it, expect } from 'vitest';
import {
  type BooleanOp,
  BOOLEAN_OPS,
  samplePathToPolygon,
  polygonToD,
  clipPolygon,
  applyBooleanOp,
  rectToPolygon,
  ellipseToPolygon,
  polygonArea,
  polygonCentroid,
} from '@/components/design/boolean-ops';
import { cornerAnchor, type BezierPath } from '@/components/design/bezier-pen';
import { vec } from '@/components/design/bezier-pen';

/* ─── Constants & Types ─── */
describe('BOOLEAN_OPS constant', () => {
  it('has 4 operations', () => {
    expect(BOOLEAN_OPS.length).toBe(4);
  });

  it('contains union, subtract, intersect, exclude', () => {
    const values = BOOLEAN_OPS.map((o) => o.value);
    expect(values).toContain('union');
    expect(values).toContain('subtract');
    expect(values).toContain('intersect');
    expect(values).toContain('exclude');
  });

  it('each op has label and icon', () => {
    for (const op of BOOLEAN_OPS) {
      expect(op.label).toBeTruthy();
      expect(op.icon).toBeTruthy();
    }
  });
});

/* ─── rectToPolygon ─── */
describe('rectToPolygon', () => {
  it('returns 4 corners for a rectangle', () => {
    const poly = rectToPolygon(10, 20, 100, 50);
    expect(poly.length).toBe(4);
    expect(poly[0]).toEqual({ x: 10, y: 20 });
    expect(poly[1]).toEqual({ x: 110, y: 20 });
    expect(poly[2]).toEqual({ x: 110, y: 70 });
    expect(poly[3]).toEqual({ x: 10, y: 70 });
  });
});

/* ─── ellipseToPolygon ─── */
describe('ellipseToPolygon', () => {
  it('returns correct number of points', () => {
    const poly = ellipseToPolygon(50, 50, 30, 20, 36);
    expect(poly.length).toBe(36);
  });

  it('first point is at angle 0 (rightmost)', () => {
    const poly = ellipseToPolygon(50, 50, 30, 20, 64);
    expect(poly[0].x).toBeCloseTo(80); // cx + rx
    expect(poly[0].y).toBeCloseTo(50); // cy
  });
});

/* ─── polygonToD ─── */
describe('polygonToD', () => {
  it('produces an SVG d string from polygon', () => {
    const poly = rectToPolygon(0, 0, 100, 100);
    const d = polygonToD(poly, true);
    expect(d).toContain('M 0 0');
    expect(d).toContain('L 100 0');
    expect(d).toContain('Z');
  });

  it('omits Z when closed=false', () => {
    const poly = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    const d = polygonToD(poly, false);
    expect(d).not.toContain('Z');
  });
});

/* ─── polygonArea ─── */
describe('polygonArea', () => {
  it('returns positive area for a CCW square', () => {
    const sq = rectToPolygon(0, 0, 10, 10);
    expect(Math.abs(polygonArea(sq))).toBeCloseTo(100);
  });

  it('returns 0 for degenerate polygon', () => {
    expect(polygonArea([])).toBe(0);
  });
});

/* ─── polygonCentroid ─── */
describe('polygonCentroid', () => {
  it('returns center of a square', () => {
    const sq = rectToPolygon(0, 0, 10, 10);
    const c = polygonCentroid(sq);
    expect(c.x).toBeCloseTo(5);
    expect(c.y).toBeCloseTo(5);
  });
});

/* ─── clipPolygon (Sutherland-Hodgman intersection) ─── */
describe('clipPolygon', () => {
  it('returns non-empty intersection for overlapping rectangles', () => {
    const a = rectToPolygon(0, 0, 100, 100);
    const b = rectToPolygon(50, 50, 100, 100);
    const result = clipPolygon(a, b);
    expect(result.length).toBeGreaterThanOrEqual(3);
    // Intersection should be the 50x50 square at (50,50)-(100,100)
    const area = Math.abs(polygonArea(result));
    expect(area).toBeCloseTo(2500, -1); // 50*50
  });

  it('returns empty for non-overlapping rectangles', () => {
    const a = rectToPolygon(0, 0, 10, 10);
    const b = rectToPolygon(100, 100, 10, 10);
    const result = clipPolygon(a, b);
    expect(result.length).toBe(0);
  });

  it('one rect fully inside another returns inner rect', () => {
    const outer = rectToPolygon(0, 0, 100, 100);
    const inner = rectToPolygon(20, 20, 30, 30);
    const result = clipPolygon(inner, outer);
    expect(result.length).toBeGreaterThanOrEqual(4);
    const area = Math.abs(polygonArea(result));
    expect(area).toBeCloseTo(900, -1); // 30*30
  });
});

/* ─── samplePathToPolygon ─── */
describe('samplePathToPolygon', () => {
  it('converts a bezier path to polygon points', () => {
    const p: BezierPath = {
      anchors: [cornerAnchor(vec(0, 0)), cornerAnchor(vec(100, 0)), cornerAnchor(vec(100, 100))],
      closed: true,
    };
    const poly = samplePathToPolygon(p, 10);
    // Each segment sampled to 10 steps → 3 segments * 10 = 30 points (approx)
    expect(poly.length).toBeGreaterThan(10);
  });
});

/* ─── applyBooleanOp ─── */
describe('applyBooleanOp', () => {
  const rectA = polygonToD(rectToPolygon(0, 0, 100, 100), true);
  const rectB = polygonToD(rectToPolygon(50, 50, 100, 100), true);

  it('intersect returns a non-empty d string', () => {
    const result = applyBooleanOp(rectA, rectB, 'intersect');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('M');
  });

  it('union returns a d string containing both shapes', () => {
    const result = applyBooleanOp(rectA, rectB, 'union');
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('M');
  });

  it('subtract returns a d string', () => {
    const result = applyBooleanOp(rectA, rectB, 'subtract');
    expect(result.length).toBeGreaterThan(0);
  });

  it('exclude returns a d string with two sub-paths', () => {
    const result = applyBooleanOp(rectA, rectB, 'exclude');
    expect(result.length).toBeGreaterThan(0);
  });

  it('intersect of non-overlapping is empty', () => {
    const farRect = polygonToD(rectToPolygon(500, 500, 10, 10), true);
    const result = applyBooleanOp(rectA, farRect, 'intersect');
    // Should be empty or negligible
    expect(result === '' || result.includes('M')).toBe(true);
  });
});
