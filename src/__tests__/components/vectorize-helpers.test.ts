// SPDX-License-Identifier: Apache-2.0
/**
 * DS-7.3 Vectorization Helper Tests
 * Tests for exported pure helpers in vectorize-client.tsx
 */
import { describe, it, expect } from 'vitest';
import {
  toBinaryMap,
  traceContours,
  simplify,
  contoursToSvgPaths,
  buildSvg,
} from '@/app/dashboard/tools/vectorize-client';

describe('DS-7.3 Vectorize — toBinaryMap', () => {
  it('converts pixel data to binary luminance map', () => {
    // 2x2 image: black, white, gray, bright
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,       // black → lum ~0, below 128 → on
      255, 255, 255, 255,  // white → lum ~255, above 128 → off
      100, 100, 100, 255,  // gray → lum ~100, below 128 → on
      200, 200, 200, 255,  // bright → lum ~200, above 128 → off
    ]);
    const map = toBinaryMap(data, 2, 2, 128, false);
    expect(map).toEqual([true, false, true, false]);
  });

  it('respects invert flag', () => {
    const data = new Uint8ClampedArray([
      0, 0, 0, 255,
      255, 255, 255, 255,
    ]);
    const map = toBinaryMap(data, 2, 1, 128, true);
    expect(map).toEqual([false, true]);
  });

  it('handles custom threshold', () => {
    const data = new Uint8ClampedArray([
      100, 100, 100, 255, // lum ~100
    ]);
    // threshold=50 → 100 is NOT below 50 → off
    expect(toBinaryMap(data, 1, 1, 50, false)).toEqual([false]);
    // threshold=150 → 100 IS below 150 → on
    expect(toBinaryMap(data, 1, 1, 150, false)).toEqual([true]);
  });
});

describe('DS-7.3 Vectorize — traceContours', () => {
  it('returns empty for all-off image', () => {
    const binary = [false, false, false, false];
    expect(traceContours(binary, 2, 2)).toEqual([]);
  });

  it('traces a simple 3x3 filled square', () => {
    // 5x5 with a 3x3 block in the center
    const binary = new Array(25).fill(false);
    for (let y = 1; y <= 3; y++) {
      for (let x = 1; x <= 3; x++) {
        binary[y * 5 + x] = true;
      }
    }
    const contours = traceContours(binary, 5, 5);
    expect(contours.length).toBeGreaterThanOrEqual(1);
    // total boundary pixels should cover the perimeter
    const totalPts = contours.reduce((s, c) => s + c.length, 0);
    expect(totalPts).toBeGreaterThanOrEqual(4);
  });

  it('ignores contours with < 4 points', () => {
    // Single pixel — a boundary pixel but too small
    const binary = new Array(9).fill(false);
    binary[4] = true; // center of 3x3
    const contours = traceContours(binary, 3, 3);
    // Single pixel contour has 1 point, should be filtered
    contours.forEach(c => {
      expect(c.length).toBeGreaterThanOrEqual(4);
    });
  });
});

describe('DS-7.3 Vectorize — simplify (Douglas-Peucker)', () => {
  it('returns same points for 2 or fewer', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    expect(simplify(pts, 5)).toEqual(pts);
  });

  it('simplifies collinear points', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    const result = simplify(pts, 1);
    expect(result).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  });

  it('keeps non-collinear points above tolerance', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 10 }, // far off the line
      { x: 10, y: 0 },
    ];
    const result = simplify(pts, 1);
    expect(result.length).toBe(3);
  });

  it('removes non-collinear points below tolerance', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 5, y: 0.1 }, // barely off the line
      { x: 10, y: 0 },
    ];
    const result = simplify(pts, 1);
    expect(result.length).toBe(2);
  });
});

describe('DS-7.3 Vectorize — contoursToSvgPaths', () => {
  it('converts contour points to SVG path data', () => {
    const contours = [
      [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }],
    ];
    const paths = contoursToSvgPaths(contours, 0);
    expect(paths.length).toBe(1);
    expect(paths[0]).toContain('M 0 0');
    expect(paths[0]).toContain('L');
    expect(paths[0]).toContain('Z');
  });

  it('applies simplification tolerance', () => {
    const contour = [
      { x: 0, y: 0 },
      { x: 5, y: 0.01 }, // nearly collinear → should be removed with tolerance > 0.01
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const paths = contoursToSvgPaths([contour], 1);
    // The nearly-collinear point should be removed
    const segments = paths[0].split(/[ML]/).filter(Boolean);
    expect(segments.length).toBe(4); // 4 points remaining
  });

  it('filters out empty paths', () => {
    const contours = [
      [{ x: 0, y: 0 }], // too short → simplify returns single point
    ];
    const paths = contoursToSvgPaths(contours, 0);
    expect(paths.length).toBe(0);
  });
});

describe('DS-7.3 Vectorize — buildSvg', () => {
  it('creates valid SVG string', () => {
    const svg = buildSvg(100, 200, ['M 0 0 L 10 0 L 10 10 Z'], '#f00');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 100 200"');
    expect(svg).toContain('width="100"');
    expect(svg).toContain('height="200"');
    expect(svg).toContain('fill="#f00"');
    expect(svg).toContain('M 0 0 L 10 0 L 10 10 Z');
  });

  it('uses black fill by default', () => {
    const svg = buildSvg(50, 50, ['M 0 0 L 1 1 Z']);
    expect(svg).toContain('fill="#000"');
  });

  it('handles multiple paths', () => {
    const svg = buildSvg(10, 10, ['M 0 0 Z', 'M 5 5 Z']);
    const pathCount = (svg.match(/<path/g) ?? []).length;
    expect(pathCount).toBe(2);
  });
});

describe('DS-7.3 Vectorize — module exports', () => {
  it('exports default VectorizeModal component', async () => {
    const mod = await import('@/app/dashboard/tools/vectorize-client');
    expect(mod.default).toBeDefined();
    expect(mod.default.name).toBe('VectorizeModal');
  });
});
