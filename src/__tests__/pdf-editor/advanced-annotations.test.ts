// SPDX-License-Identifier: Apache-2.0
/**
 * Advanced Annotations Engine Tests — Sprint 12
 *
 * Tests for: Callout bubbles, Polygon shapes (presets, custom),
 * Polyline annotations, SVG generation, hit-testing, and transforms.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  // Callout
  createCallout,
  updateCalloutText,
  moveLeaderPoint,
  generateCalloutPath,
  getCalloutBounds,
  // Polygon
  createPolygon,
  createPresetPolygon,
  regularPolygon,
  starPolygon,
  crossPolygon,
  generatePresetVertices,
  polygonCenter,
  polygonBounds,
  verticesToSvgPoints,
  scaleVertices,
  rotateVertices,
  pointInPolygon,
  // Polyline
  createPolyline,
  pointsToSvgPath,
  polylineLength,
  // Constants
  DEFAULT_CALLOUT,
  DEFAULT_POLYGON,
  DEFAULT_POLYLINE,
  CALLOUT_STYLES,
  POLYGON_PRESETS,
  resetAdvancedCounters,
  type Point2D,
} from '@/app/dashboard/tools/pdf-editor/engine/advanced-annotations';

describe('Advanced Annotations Engine', () => {
  beforeEach(() => {
    resetAdvancedCounters();
  });

  /* ══════════════════ CALLOUT ══════════════════ */

  describe('Callout Annotations', () => {
    describe('createCallout', () => {
      it('creates a callout with defaults', () => {
        const c = createCallout(
          1,
          100,
          100,
          200,
          80,
          { x: 50, y: 200 },
          'Note',
        );
        expect(c.id).toMatch(/^callout-/);
        expect(c.kind).toBe('callout');
        expect(c.page).toBe(1);
        expect(c.text).toBe('Note');
        expect(c.leaderPoint).toEqual({ x: 50, y: 200 });
        expect(c.style).toBe('rounded');
        expect(c.backgroundColor).toBe(DEFAULT_CALLOUT.backgroundColor);
      });

      it('enforces minimum width (40) and height (30)', () => {
        const c = createCallout(1, 0, 0, 10, 5, { x: 0, y: 0 }, '');
        expect(c.width).toBe(40);
        expect(c.height).toBe(30);
      });

      it('accepts custom options', () => {
        const c = createCallout(1, 0, 0, 100, 50, { x: 0, y: 0 }, 'Hi', {
          style: 'cloud',
          borderColor: '#ff0000',
          fontSize: 20,
        });
        expect(c.style).toBe('cloud');
        expect(c.borderColor).toBe('#ff0000');
        expect(c.fontSize).toBe(20);
      });
    });

    describe('updateCalloutText', () => {
      it('updates text immutably', () => {
        const c = createCallout(1, 0, 0, 100, 50, { x: 0, y: 0 }, 'Old');
        const updated = updateCalloutText(c, 'New');
        expect(updated.text).toBe('New');
        expect(c.text).toBe('Old'); // original unchanged
      });
    });

    describe('moveLeaderPoint', () => {
      it('moves the leader point immutably', () => {
        const c = createCallout(1, 0, 0, 100, 50, { x: 10, y: 10 }, '');
        const moved = moveLeaderPoint(c, { x: 200, y: 300 });
        expect(moved.leaderPoint).toEqual({ x: 200, y: 300 });
        expect(c.leaderPoint).toEqual({ x: 10, y: 10 });
      });
    });

    describe('generateCalloutPath', () => {
      it('generates valid SVG path for a rounded callout', () => {
        const c = createCallout(1, 50, 50, 150, 80, { x: 20, y: 200 }, 'Test');
        const path = generateCalloutPath(c);
        expect(path).toContain('M');
        expect(path).toContain('Q');
        expect(path).toContain('Z');
      });

      it('generates a square callout path', () => {
        const c = createCallout(1, 50, 50, 150, 80, { x: 20, y: 200 }, 'Test', {
          style: 'square',
        });
        const path = generateCalloutPath(c);
        expect(path).toContain('M');
        expect(path).toContain('Z');
      });
    });

    describe('getCalloutBounds', () => {
      it('includes the leader point in bounds', () => {
        const c = createCallout(1, 100, 100, 200, 80, { x: 50, y: 300 }, '');
        const bounds = getCalloutBounds(c);
        expect(bounds.x).toBe(50); // min of 100 and 50
        expect(bounds.y).toBe(100); // min of 100 and 300
        expect(bounds.width).toBe(250); // 300 - 50
        expect(bounds.height).toBe(200); // 300 - 100
      });
    });
  });

  /* ══════════════════ POLYGON ══════════════════ */

  describe('Polygon Annotations', () => {
    describe('regularPolygon', () => {
      it('generates a triangle with 3 vertices', () => {
        const v = regularPolygon(100, 100, 50, 3);
        expect(v).toHaveLength(3);
      });

      it('generates a hexagon with 6 vertices', () => {
        const v = regularPolygon(0, 0, 100, 6);
        expect(v).toHaveLength(6);
      });

      it('first vertex is at the top', () => {
        const v = regularPolygon(0, 0, 50, 4);
        // First vertex at angle -π/2 → (0, -50)
        expect(v[0].x).toBeCloseTo(0, 5);
        expect(v[0].y).toBeCloseTo(-50, 5);
      });
    });

    describe('starPolygon', () => {
      it('generates 10 points for a 5-pointed star', () => {
        const v = starPolygon(0, 0, 50, 5);
        expect(v).toHaveLength(10);
      });

      it('alternates between outer and inner radius', () => {
        const v = starPolygon(0, 0, 100, 5);
        const outerDist = Math.sqrt(v[0].x ** 2 + v[0].y ** 2);
        const innerDist = Math.sqrt(v[1].x ** 2 + v[1].y ** 2);
        expect(outerDist).toBeCloseTo(100, 0);
        expect(innerDist).toBeCloseTo(40, 0); // 100 * 0.4
      });
    });

    describe('crossPolygon', () => {
      it('generates 12 vertices', () => {
        const v = crossPolygon(0, 0, 50);
        expect(v).toHaveLength(12);
      });
    });

    describe('generatePresetVertices', () => {
      it('generates correct presets for each shape', () => {
        expect(generatePresetVertices('triangle', 0, 0, 50)).toHaveLength(3);
        expect(generatePresetVertices('pentagon', 0, 0, 50)).toHaveLength(5);
        expect(generatePresetVertices('hexagon', 0, 0, 50)).toHaveLength(6);
        expect(generatePresetVertices('octagon', 0, 0, 50)).toHaveLength(8);
        expect(generatePresetVertices('star-5', 0, 0, 50)).toHaveLength(10);
        expect(generatePresetVertices('star-6', 0, 0, 50)).toHaveLength(12);
        expect(generatePresetVertices('star-8', 0, 0, 50)).toHaveLength(16);
        expect(generatePresetVertices('diamond', 0, 0, 50)).toHaveLength(4);
        expect(generatePresetVertices('cross', 0, 0, 50)).toHaveLength(12);
        expect(generatePresetVertices('custom', 0, 0, 50)).toHaveLength(0);
      });
    });

    describe('createPolygon', () => {
      it('creates a polygon annotation', () => {
        const v: Point2D[] = [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 50, y: 86 },
        ];
        const p = createPolygon(1, v);
        expect(p.id).toMatch(/^polygon-/);
        expect(p.kind).toBe('polygon');
        expect(p.vertices).toHaveLength(3);
        expect(p.fill).toBe(DEFAULT_POLYGON.fill);
      });

      it('throws for fewer than 3 vertices', () => {
        expect(() =>
          createPolygon(1, [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]),
        ).toThrow('at least 3 vertices');
      });
    });

    describe('createPresetPolygon', () => {
      it('creates a preset polygon', () => {
        const p = createPresetPolygon(1, 'hexagon', 100, 100, 50);
        expect(p.preset).toBe('hexagon');
        expect(p.vertices).toHaveLength(6);
      });

      it('throws for custom preset (no auto-generated vertices)', () => {
        expect(() => createPresetPolygon(1, 'custom', 0, 0, 50)).toThrow(
          'enough vertices',
        );
      });
    });

    describe('polygon geometry helpers', () => {
      const triangle: Point2D[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 100 },
      ];

      it('calculates center', () => {
        const c = polygonCenter(triangle);
        expect(c.x).toBe(50);
        expect(c.y).toBeCloseTo(33.33, 1);
      });

      it('calculates bounding box', () => {
        const bounds = polygonBounds(triangle);
        expect(bounds).toEqual({ x: 0, y: 0, width: 100, height: 100 });
      });

      it('converts to SVG points string', () => {
        const svg = verticesToSvgPoints(triangle);
        expect(svg).toBe('0,0 100,0 50,100');
      });

      it('returns zero bounds for empty array', () => {
        expect(polygonBounds([])).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      });
    });

    describe('scaleVertices', () => {
      it('scales vertices from center', () => {
        const v: Point2D[] = [
          { x: -10, y: -10 },
          { x: 10, y: -10 },
          { x: 10, y: 10 },
          { x: -10, y: 10 },
        ];
        const scaled = scaleVertices(v, 2);
        expect(scaled[0].x).toBeCloseTo(-20, 5);
        expect(scaled[2].x).toBeCloseTo(20, 5);
      });
    });

    describe('rotateVertices', () => {
      it('rotates 90° correctly', () => {
        const v: Point2D[] = [{ x: 10, y: 0 }];
        const rotated = rotateVertices(v, 90, { x: 0, y: 0 });
        expect(rotated[0].x).toBeCloseTo(0, 5);
        expect(rotated[0].y).toBeCloseTo(10, 5);
      });
    });

    describe('pointInPolygon', () => {
      const square: Point2D[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      it('returns true for point inside', () => {
        expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
      });

      it('returns false for point outside', () => {
        expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
      });
    });
  });

  /* ══════════════════ POLYLINE ══════════════════ */

  describe('Polyline Annotations', () => {
    describe('createPolyline', () => {
      it('creates a polyline annotation', () => {
        const pl = createPolyline(1, [
          { x: 0, y: 0 },
          { x: 100, y: 50 },
          { x: 200, y: 0 },
        ]);
        expect(pl.id).toMatch(/^polyline-/);
        expect(pl.kind).toBe('polyline');
        expect(pl.points).toHaveLength(3);
        expect(pl.endMarker).toBe(DEFAULT_POLYLINE.endMarker);
      });

      it('throws for fewer than 2 points', () => {
        expect(() => createPolyline(1, [{ x: 0, y: 0 }])).toThrow(
          'at least 2 points',
        );
      });
    });

    describe('pointsToSvgPath', () => {
      it('generates SVG path', () => {
        const path = pointsToSvgPath([
          { x: 10, y: 20 },
          { x: 30, y: 40 },
          { x: 50, y: 60 },
        ]);
        expect(path).toBe('M 10 20 L 30 40 L 50 60');
      });

      it('returns empty for no points', () => {
        expect(pointsToSvgPath([])).toBe('');
      });
    });

    describe('polylineLength', () => {
      it('calculates total length', () => {
        const len = polylineLength([
          { x: 0, y: 0 },
          { x: 3, y: 4 },
          { x: 6, y: 0 },
        ]);
        expect(len).toBeCloseTo(10, 5);
      });
    });
  });

  /* ══════════════════ CONSTANTS ══════════════════ */

  describe('constants', () => {
    it('has all callout styles', () => {
      expect(CALLOUT_STYLES).toContain('rounded');
      expect(CALLOUT_STYLES).toContain('square');
      expect(CALLOUT_STYLES).toContain('cloud');
      expect(CALLOUT_STYLES).toContain('thought');
      expect(CALLOUT_STYLES).toHaveLength(4);
    });

    it('has all polygon presets', () => {
      expect(POLYGON_PRESETS).toHaveLength(10);
      expect(POLYGON_PRESETS).toContain('triangle');
      expect(POLYGON_PRESETS).toContain('star-5');
      expect(POLYGON_PRESETS).toContain('custom');
    });

    it('has valid default callout config', () => {
      expect(DEFAULT_CALLOUT.fontFamily).toBe('Helvetica');
      expect(DEFAULT_CALLOUT.opacity).toBe(1);
    });

    it('has valid default polygon config', () => {
      expect(DEFAULT_POLYGON.fill).toBe('transparent');
      expect(DEFAULT_POLYGON.strokeWidth).toBe(2);
    });

    it('has valid default polyline config', () => {
      expect(DEFAULT_POLYLINE.endMarker).toBe('arrow');
      expect(DEFAULT_POLYLINE.strokeWidth).toBe(2);
    });
  });
});
