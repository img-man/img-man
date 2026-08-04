// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for freehand-engine.ts
 *
 * Covers FreehandPathBuilder, findEraserTargets, svgPathToPoints, scaleSvgPath
 */

import { describe, it, expect } from 'vitest';
import {
  FreehandPathBuilder,
  findEraserTargets,
  svgPathToPoints,
  scaleSvgPath,
} from '@/app/dashboard/tools/pdf-editor/engine/freehand-engine';
import type { Annotation } from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── FreehandPathBuilder ──────────────── */

describe('FreehandPathBuilder', () => {
  it('should create a builder and add points', () => {
    const builder = new FreehandPathBuilder();
    builder.addPoint({ x: 10, y: 20 });
    builder.addPoint({ x: 30, y: 40 });
    builder.addPoint({ x: 50, y: 60 });

    const result = builder.build();
    expect(result).not.toBeNull();
    expect(result!.points.length).toBeGreaterThanOrEqual(2);
    expect(result!.svgPath).toContain('M');
    expect(result!.bounds).toBeDefined();
    expect(result!.bounds.x).toBeLessThanOrEqual(10);
    expect(result!.bounds.y).toBeLessThanOrEqual(20);
  });

  it('should return a minimal path for a single point', () => {
    const builder = new FreehandPathBuilder();
    builder.addPoint({ x: 10, y: 20 });
    const result = builder.build();
    expect(result.points).toHaveLength(1);
    expect(result.svgPath).toContain('M');
  });

  it('should create a straight line path for 2 points', () => {
    const builder = new FreehandPathBuilder();
    builder.addPoint({ x: 0, y: 0 });
    builder.addPoint({ x: 100, y: 100 });

    const result = builder.build();
    expect(result).not.toBeNull();
    expect(result!.svgPath).toContain('M');
    expect(result!.svgPath).toContain('L');
  });

  it('should build smooth Bézier path for 3+ points', () => {
    const builder = new FreehandPathBuilder();
    for (let i = 0; i < 10; i++) {
      builder.addPoint({ x: i * 10, y: Math.sin(i) * 50 });
    }

    const result = builder.build();
    expect(result).not.toBeNull();
    expect(result!.svgPath).toContain('Q'); // Quadratic Bézier
  });

  it('should filter out points too close together', () => {
    const builder = new FreehandPathBuilder();
    builder.addPoint({ x: 10, y: 10 });
    builder.addPoint({ x: 10.5, y: 10.5 }); // Too close (< FREEHAND_MIN_DISTANCE)
    builder.addPoint({ x: 11, y: 11 }); // Also too close
    builder.addPoint({ x: 50, y: 50 }); // Far enough

    const result = builder.build();
    expect(result).not.toBeNull();
    // At least the first and last points should be kept
    expect(result!.points.length).toBeGreaterThanOrEqual(2);
  });

  it('should compute accurate bounds', () => {
    const builder = new FreehandPathBuilder();
    builder.addPoint({ x: 10, y: 20 });
    builder.addPoint({ x: 100, y: 200 });
    builder.addPoint({ x: 50, y: 80 });

    const result = builder.build();
    expect(result).not.toBeNull();
    expect(result!.bounds.x).toBe(10);
    expect(result!.bounds.y).toBe(20);
    expect(result!.bounds.width).toBe(90);
    expect(result!.bounds.height).toBe(180);
  });
});

/* ──────────────── findEraserTargets ──────────────── */

describe('findEraserTargets', () => {
  const makeAnnotation = (
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): Annotation =>
    ({
      id,
      kind: 'highlight',
      page: 1,
      x,
      y,
      width,
      height,
      color: '#FF0',
      opacity: 0.4,
    }) as Annotation;

  it('should find annotations within eraser radius', () => {
    const annotations = [
      makeAnnotation('a1', 10, 10, 50, 20),
      makeAnnotation('a2', 200, 200, 50, 20),
    ];

    const targets = findEraserTargets(30, 20, 10, annotations);
    expect(targets).toHaveLength(1);
    expect(targets[0]).toBe('a1');
  });

  it('should return empty for no hits', () => {
    const annotations = [makeAnnotation('a1', 100, 100, 50, 20)];
    const targets = findEraserTargets(0, 0, 5, annotations);
    expect(targets).toHaveLength(0);
  });

  it('should hit annotation when circle barely touches edge', () => {
    const annotations = [makeAnnotation('a1', 20, 20, 50, 20)];
    // Position eraser just at the left edge
    const targets = findEraserTargets(15, 30, 10, annotations);
    expect(targets).toHaveLength(1);
  });

  it('should find multiple overlapping annotations', () => {
    const annotations = [
      makeAnnotation('a1', 10, 10, 100, 100),
      makeAnnotation('a2', 20, 20, 100, 100),
      makeAnnotation('a3', 500, 500, 50, 50),
    ];
    const targets = findEraserTargets(50, 50, 15, annotations);
    expect(targets).toHaveLength(2);
    expect(targets).toContain('a1');
    expect(targets).toContain('a2');
  });
});

/* ──────────────── svgPathToPoints ──────────────── */

describe('svgPathToPoints', () => {
  it('should parse M and L commands', () => {
    const points = svgPathToPoints('M 10 20 L 30 40 L 50 60');
    expect(points).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ]);
  });

  it('should parse Q (quadratic Bézier) and use end point', () => {
    const points = svgPathToPoints('M 0 0 Q 50 50 100 100');
    expect(points).toHaveLength(2);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[1]).toEqual({ x: 100, y: 100 });
  });

  it('should return empty for empty string', () => {
    expect(svgPathToPoints('')).toEqual([]);
  });
});

/* ──────────────── scaleSvgPath ──────────────── */

describe('scaleSvgPath', () => {
  it('should scale coordinates by factor', () => {
    const scaled = scaleSvgPath('M 10 20 L 30 40', 2);
    // Numbers should be doubled
    expect(scaled).toContain('20');
    expect(scaled).toContain('40');
    expect(scaled).toContain('60');
    expect(scaled).toContain('80');
  });

  it('should handle scale of 1 (no change)', () => {
    const original = 'M 10 20 L 30 40';
    const scaled = scaleSvgPath(original, 1);
    // Should have same numeric values
    expect(scaled).toContain('10');
    expect(scaled).toContain('20');
    expect(scaled).toContain('30');
    expect(scaled).toContain('40');
  });

  it('should handle fractional scales', () => {
    const scaled = scaleSvgPath('M 100 200', 0.5);
    expect(scaled).toContain('50');
    expect(scaled).toContain('100');
  });
});
