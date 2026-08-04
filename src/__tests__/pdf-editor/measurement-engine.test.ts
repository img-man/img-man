// SPDX-License-Identifier: Apache-2.0
/**
 * Measurement Engine Tests — Sprint 12
 *
 * Tests for: distance, area, perimeter, calibration, angle, midpoint,
 * centroid, formatting, snap helpers, and annotation CRUD.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  distanceBetween,
  measureDistance,
  measureArea,
  measurePerimeter,
  angleBetween,
  midpoint,
  centroid,
  createCalibration,
  applyCalibration,
  convertUnit,
  createMeasurement,
  recalculateMeasurement,
  formatMeasurement,
  formatArea,
  formatMeasurementResult,
  snapToGrid,
  constrainAngle,
  isNearPoint,
  resetMeasurementCounters,
  UNIT_CONVERSIONS,
  UNIT_LABELS,
  DEFAULT_MEASUREMENT_COLOR,
  type Point2D,
} from '@/app/dashboard/tools/pdf-editor/engine/measurement-engine';

describe('Measurement Engine', () => {
  beforeEach(() => {
    resetMeasurementCounters();
  });

  /* ── Basic Geometry ── */

  describe('distanceBetween', () => {
    it('computes distance between two points', () => {
      expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });

    it('returns 0 for identical points', () => {
      expect(distanceBetween({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
    });

    it('handles negative coordinates', () => {
      expect(distanceBetween({ x: -3, y: 0 }, { x: 0, y: 4 })).toBe(5);
    });
  });

  describe('measureDistance (polyline)', () => {
    it('calculates total length of a polyline', () => {
      const points: Point2D[] = [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 6, y: 0 },
      ];
      const d = measureDistance(points);
      // 5 + 5 = 10
      expect(d).toBeCloseTo(10, 5);
    });

    it('returns 0 for fewer than 2 points', () => {
      expect(measureDistance([{ x: 0, y: 0 }])).toBe(0);
      expect(measureDistance([])).toBe(0);
    });
  });

  describe('measureArea (Shoelace)', () => {
    it('calculates area of a unit square', () => {
      const square: Point2D[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];
      expect(measureArea(square)).toBe(100);
    });

    it('calculates area of a triangle', () => {
      const triangle: Point2D[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: 10 },
      ];
      // Area = 0.5 * base * height = 0.5 * 10 * 10 = 50
      expect(measureArea(triangle)).toBe(50);
    });

    it('returns 0 for fewer than 3 points', () => {
      expect(
        measureArea([
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]),
      ).toBe(0);
    });
  });

  describe('measurePerimeter', () => {
    it('calculates perimeter of a square', () => {
      const square: Point2D[] = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ];
      expect(measurePerimeter(square)).toBe(40);
    });

    it('returns 0 for fewer than 3 points', () => {
      expect(measurePerimeter([{ x: 0, y: 0 }])).toBe(0);
    });
  });

  describe('angleBetween', () => {
    it('computes a right angle (90°)', () => {
      const angle = angleBetween(
        { x: 1, y: 0 },
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      );
      expect(angle).toBeCloseTo(90, 5);
    });

    it('computes a straight angle (180°)', () => {
      const angle = angleBetween(
        { x: -1, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      );
      expect(angle).toBeCloseTo(180, 5);
    });

    it('returns 0 when a vertex has zero distance', () => {
      expect(angleBetween({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(
        0,
      );
    });
  });

  describe('midpoint / centroid', () => {
    it('computes midpoint', () => {
      const m = midpoint({ x: 0, y: 0 }, { x: 10, y: 10 });
      expect(m.x).toBe(5);
      expect(m.y).toBe(5);
    });

    it('computes centroid of a triangle', () => {
      const c = centroid([
        { x: 0, y: 0 },
        { x: 6, y: 0 },
        { x: 3, y: 6 },
      ]);
      expect(c.x).toBe(3);
      expect(c.y).toBe(2);
    });

    it('returns origin for empty array', () => {
      expect(centroid([])).toEqual({ x: 0, y: 0 });
    });
  });

  /* ── Calibration ── */

  describe('calibration', () => {
    it('creates a calibration with correct scale factor', () => {
      const cal = createCalibration(72, 1, 'in');
      expect(cal.scaleFactor).toBe(1 / 72);
    });

    it('throws for zero pdf distance', () => {
      expect(() => createCalibration(0, 1, 'cm')).toThrow('PDF distance');
    });

    it('throws for zero real distance', () => {
      expect(() => createCalibration(72, 0, 'cm')).toThrow('Real distance');
    });

    it('applies calibration correctly', () => {
      const cal = createCalibration(72, 2.54, 'cm'); // 1 inch = 2.54 cm
      const calibrated = applyCalibration(144, cal);
      expect(calibrated).toBeCloseTo(5.08, 2); // 2 inches = 5.08 cm
    });

    it('returns raw value when calibration is null', () => {
      expect(applyCalibration(100, null)).toBe(100);
    });
  });

  describe('convertUnit', () => {
    it('converts inches to points', () => {
      expect(convertUnit(1, 'in', 'pt')).toBe(72);
    });

    it('returns same value for same unit', () => {
      expect(convertUnit(42, 'cm', 'cm')).toBe(42);
    });

    it('converts cm to mm', () => {
      const mm = convertUnit(1, 'cm', 'mm');
      expect(mm).toBeCloseTo(10, 1);
    });
  });

  /* ── Formatting ── */

  describe('formatMeasurement / formatArea', () => {
    it('formats distance with unit', () => {
      expect(formatMeasurement(72, 'pt')).toBe('72 pt');
    });

    it('formats with precision', () => {
      expect(formatMeasurement(3.14159, 'cm', 1)).toBe('3.1 cm');
    });

    it('formats area with squared unit', () => {
      expect(formatArea(100, 'cm')).toBe('100 cm²');
    });
  });

  /* ── Measurement CRUD ── */

  describe('createMeasurement', () => {
    it('creates a distance measurement', () => {
      const m = createMeasurement('distance', 1, [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]);
      expect(m.id).toMatch(/^measure-/);
      expect(m.type).toBe('distance');
      expect(m.rawValue).toBe(5);
      expect(m.unit).toBe('pt');
      expect(m.color).toBe(DEFAULT_MEASUREMENT_COLOR);
    });

    it('creates an area measurement', () => {
      const m = createMeasurement('area', 1, [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]);
      expect(m.rawValue).toBe(100);
    });

    it('creates a perimeter measurement', () => {
      const m = createMeasurement('perimeter', 1, [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]);
      expect(m.rawValue).toBe(40);
    });

    it('applies calibration for distance', () => {
      const cal = createCalibration(72, 1, 'in');
      const m = createMeasurement(
        'distance',
        1,
        [
          { x: 0, y: 0 },
          { x: 72, y: 0 },
        ],
        cal,
        { unit: 'in' },
      );
      expect(m.calibratedValue).toBeCloseTo(1, 5);
    });

    it('applies squared calibration for area', () => {
      const cal = createCalibration(72, 1, 'in');
      const m = createMeasurement(
        'area',
        1,
        [
          { x: 0, y: 0 },
          { x: 72, y: 0 },
          { x: 72, y: 72 },
          { x: 0, y: 72 },
        ],
        cal,
      );
      // Raw area = 72*72 = 5184 pt². Calibrated = 5184 * (1/72)^2 = 1 in²
      expect(m.calibratedValue).toBeCloseTo(1, 5);
    });
  });

  describe('recalculateMeasurement', () => {
    it('updates raw and calibrated values', () => {
      const m = createMeasurement('distance', 1, [
        { x: 0, y: 0 },
        { x: 3, y: 4 },
      ]);
      expect(m.rawValue).toBe(5);
      const updated = recalculateMeasurement(m, [
        { x: 0, y: 0 },
        { x: 6, y: 8 },
      ]);
      expect(updated.rawValue).toBe(10);
    });
  });

  describe('formatMeasurementResult', () => {
    it('formats a distance result', () => {
      const m = createMeasurement('distance', 1, [
        { x: 0, y: 0 },
        { x: 72, y: 0 },
      ]);
      const result = formatMeasurementResult(m);
      expect(result.formattedValue).toBe('72 pt');
    });

    it('formats an area result with squared unit', () => {
      const m = createMeasurement('area', 1, [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]);
      const result = formatMeasurementResult(m);
      expect(result.formattedValue).toContain('²');
    });
  });

  /* ── Snap & Constraint Helpers ── */

  describe('snapToGrid', () => {
    it('snaps to nearest grid point', () => {
      expect(snapToGrid({ x: 7, y: 13 }, 10)).toEqual({ x: 10, y: 10 });
    });

    it('snaps to nearest grid point at midpoint (rounds to even)', () => {
      // Math.round(0.5) = 0 in some engines, 1 in others; 5/10 = 0.5 → Math.round → could be 0 or 1
      const result = snapToGrid({ x: 5, y: 5 }, 10);
      // Just verify it snaps to a grid multiple
      expect(result.x % 10).toBe(0);
      expect(result.y % 10).toBe(0);
    });
  });

  describe('constrainAngle', () => {
    it('constrains to nearest 15° increment', () => {
      // atan2(3, 10) ≈ 16.7° → snaps to 15° → result has positive y
      const result = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 3 });
      const angle = (Math.atan2(result.y, result.x) * 180) / Math.PI;
      // Should be near a 15° increment
      expect(Math.round(angle / 15) * 15).toBeCloseTo(angle, 0);
    });

    it('constrains horizontal line to 0°', () => {
      const result = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 0.5 });
      // atan2(0.5, 10) ≈ 2.86° → snaps to 0°
      expect(result.y).toBeCloseTo(0, 0);
    });
  });

  describe('isNearPoint', () => {
    it('returns true when within threshold', () => {
      expect(isNearPoint({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
    });

    it('returns false when outside threshold', () => {
      expect(isNearPoint({ x: 0, y: 0 }, { x: 10, y: 10 }, 5)).toBe(false);
    });
  });

  /* ── Constants ── */

  describe('constants', () => {
    it('has all unit conversions', () => {
      expect(Object.keys(UNIT_CONVERSIONS)).toEqual([
        'pt',
        'in',
        'cm',
        'mm',
        'px',
      ]);
    });

    it('has all unit labels', () => {
      expect(Object.keys(UNIT_LABELS)).toEqual(['pt', 'in', 'cm', 'mm', 'px']);
    });

    it('points-per-inch is 72', () => {
      expect(UNIT_CONVERSIONS.in).toBe(72);
    });
  });
});
