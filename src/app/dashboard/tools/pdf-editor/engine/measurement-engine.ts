// SPDX-License-Identifier: Apache-2.0
/**
 * Measurement Engine — Sprint 12
 *
 * Provides on-canvas measurement tools for PDF documents:
 * - Distance (line between two points)
 * - Area (polygon/rectangle region)
 * - Perimeter (boundary length)
 * - Calibration (set real-world scale from a known distance)
 *
 * All coordinates are in PDF points (1/72 inch) by default.
 * When a calibration is set, results are converted to real-world units.
 *
 * @see agent-docs/plans/PDF_EDITOR_MASTER_PLAN.md — Phase 5 (A14: Measurement tool)
 */

/* ──────────────────────── Types ──────────────────────── */

export type MeasurementUnit = 'pt' | 'in' | 'cm' | 'mm' | 'px';
export type MeasurementType = 'distance' | 'area' | 'perimeter';

export interface Point2D {
  x: number;
  y: number;
}

export interface Calibration {
  /** Known distance in PDF points */
  pdfDistance: number;
  /** Real-world distance value */
  realDistance: number;
  /** Real-world unit */
  unit: MeasurementUnit;
  /** Scale factor: realDistance / pdfDistance */
  scaleFactor: number;
}

export interface MeasurementAnnotation {
  id: string;
  type: MeasurementType;
  page: number;
  /** Ordered list of points defining the measurement */
  points: Point2D[];
  /** Computed result in PDF points */
  rawValue: number;
  /** Computed result in calibrated units (same as raw if no calibration) */
  calibratedValue: number;
  /** Display unit */
  unit: MeasurementUnit;
  /** Visual properties */
  color: string;
  strokeWidth: number;
  /** Show label on canvas */
  showLabel: boolean;
  /** Label position offset */
  labelOffset: Point2D;
  /** Timestamp */
  createdAt: number;
}

export interface MeasurementResult {
  rawValue: number;
  calibratedValue: number;
  unit: MeasurementUnit;
  formattedValue: string;
}

/* ──────────────────────── Constants ──────────────────────── */

/** Points per unit conversion table (1 pt = 1/72 inch) */
export const UNIT_CONVERSIONS: Record<MeasurementUnit, number> = {
  pt: 1,
  in: 72, // 72 pt = 1 inch
  cm: 28.3465, // 72/2.54
  mm: 2.83465, // 72/25.4
  px: 1, // 1:1 at 72 DPI
};

export const UNIT_LABELS: Record<MeasurementUnit, string> = {
  pt: 'pt',
  in: 'in',
  cm: 'cm',
  mm: 'mm',
  px: 'px',
};

export const DEFAULT_MEASUREMENT_COLOR = '#3b82f6';
export const DEFAULT_STROKE_WIDTH = 2;
export const MIN_POINTS_DISTANCE = 2;
export const MIN_POINTS_AREA = 3;
export const MIN_POINTS_PERIMETER = 3;

/* ──────────────────────── ID Generation ──────────────────────── */

let _measureCounter = 0;

export function resetMeasurementCounters(): void {
  _measureCounter = 0;
}

/* ──────────────────────── Calibration ──────────────────────── */

/**
 * Create a calibration from a measured PDF distance and a known real-world value.
 * Example: User draws a line over a ruler marking 5cm → pdfDistance=142, realDistance=5, unit='cm'.
 */
export function createCalibration(
  pdfDistance: number,
  realDistance: number,
  unit: MeasurementUnit,
): Calibration {
  if (pdfDistance <= 0) throw new Error('PDF distance must be positive');
  if (realDistance <= 0) throw new Error('Real distance must be positive');
  return {
    pdfDistance,
    realDistance,
    unit,
    scaleFactor: realDistance / pdfDistance,
  };
}

/**
 * Apply calibration to convert a raw PDF-point measurement to real-world units.
 */
export function applyCalibration(
  rawValue: number,
  calibration: Calibration | null,
): number {
  if (!calibration) return rawValue;
  return rawValue * calibration.scaleFactor;
}

/**
 * Convert a value from one unit to another (without calibration).
 */
export function convertUnit(
  value: number,
  from: MeasurementUnit,
  to: MeasurementUnit,
): number {
  if (from === to) return value;
  // Convert to points first, then to target
  const inPoints = value * UNIT_CONVERSIONS[from];
  return inPoints / UNIT_CONVERSIONS[to];
}

/* ──────────────────────── Geometry Calculations ──────────────────────── */

/**
 * Euclidean distance between two points.
 */
export function distanceBetween(a: Point2D, b: Point2D): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

/**
 * Measure the total distance of a polyline (sum of segment lengths).
 */
export function measureDistance(points: Point2D[]): number {
  if (points.length < MIN_POINTS_DISTANCE) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceBetween(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Calculate the area of a polygon using the Shoelace formula.
 * Points should be ordered (clockwise or counter-clockwise).
 */
export function measureArea(points: Point2D[]): number {
  if (points.length < MIN_POINTS_AREA) return 0;
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Calculate the perimeter of a polygon (closed path).
 */
export function measurePerimeter(points: Point2D[]): number {
  if (points.length < MIN_POINTS_PERIMETER) return 0;
  let perimeter = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    perimeter += distanceBetween(points[i], points[j]);
  }
  return perimeter;
}

/**
 * Calculate the angle in degrees between three points (vertex at b).
 */
export function angleBetween(a: Point2D, b: Point2D, c: Point2D): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2);
  if (magAB === 0 || magCB === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cosAngle) * 180) / Math.PI;
}

/**
 * Compute midpoint between two points (for label placement).
 */
export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Compute centroid of a polygon (for label placement).
 */
export function centroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/* ──────────────────────── Measurement Formatting ──────────────────────── */

/**
 * Format a measurement value with unit label.
 */
export function formatMeasurement(
  value: number,
  unit: MeasurementUnit,
  precision: number = 2,
): string {
  const rounded = Number(value.toFixed(precision));
  return `${rounded} ${UNIT_LABELS[unit]}`;
}

/**
 * Format an area measurement (square units).
 */
export function formatArea(
  value: number,
  unit: MeasurementUnit,
  precision: number = 2,
): string {
  const rounded = Number(value.toFixed(precision));
  return `${rounded} ${UNIT_LABELS[unit]}²`;
}

/* ──────────────────────── Measurement Annotation CRUD ──────────────────────── */

/**
 * Create a new measurement annotation.
 */
export function createMeasurement(
  type: MeasurementType,
  page: number,
  points: Point2D[],
  calibration: Calibration | null = null,
  options: {
    color?: string;
    strokeWidth?: number;
    unit?: MeasurementUnit;
    showLabel?: boolean;
  } = {},
): MeasurementAnnotation {
  const unit = options.unit ?? calibration?.unit ?? 'pt';
  let rawValue: number;

  switch (type) {
    case 'distance':
      rawValue = measureDistance(points);
      break;
    case 'area':
      rawValue = measureArea(points);
      break;
    case 'perimeter':
      rawValue = measurePerimeter(points);
      break;
  }

  // For area, calibration factor is squared
  let calibratedValue: number;
  if (calibration) {
    if (type === 'area') {
      calibratedValue =
        rawValue * calibration.scaleFactor * calibration.scaleFactor;
    } else {
      calibratedValue = applyCalibration(rawValue, calibration);
    }
  } else {
    calibratedValue = rawValue;
  }

  _measureCounter++;

  return {
    id: `measure-${Date.now()}-${_measureCounter}`,
    type,
    page,
    points,
    rawValue,
    calibratedValue,
    unit,
    color: options.color ?? DEFAULT_MEASUREMENT_COLOR,
    strokeWidth: options.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    showLabel: options.showLabel ?? true,
    labelOffset:
      type === 'distance'
        ? midpoint(points[0], points[points.length - 1])
        : centroid(points),
    createdAt: Date.now(),
  };
}

/**
 * Recalculate a measurement after points have been moved.
 */
export function recalculateMeasurement(
  measurement: MeasurementAnnotation,
  newPoints: Point2D[],
  calibration: Calibration | null = null,
): MeasurementAnnotation {
  let rawValue: number;
  switch (measurement.type) {
    case 'distance':
      rawValue = measureDistance(newPoints);
      break;
    case 'area':
      rawValue = measureArea(newPoints);
      break;
    case 'perimeter':
      rawValue = measurePerimeter(newPoints);
      break;
  }

  let calibratedValue: number;
  if (calibration) {
    calibratedValue =
      measurement.type === 'area'
        ? rawValue * calibration.scaleFactor * calibration.scaleFactor
        : applyCalibration(rawValue, calibration);
  } else {
    calibratedValue = rawValue;
  }

  return {
    ...measurement,
    points: newPoints,
    rawValue,
    calibratedValue,
    labelOffset:
      measurement.type === 'distance'
        ? midpoint(newPoints[0], newPoints[newPoints.length - 1])
        : centroid(newPoints),
  };
}

/**
 * Format the result of a measurement annotation for display.
 */
export function formatMeasurementResult(
  measurement: MeasurementAnnotation,
): MeasurementResult {
  const formatted =
    measurement.type === 'area'
      ? formatArea(measurement.calibratedValue, measurement.unit)
      : formatMeasurement(measurement.calibratedValue, measurement.unit);

  return {
    rawValue: measurement.rawValue,
    calibratedValue: measurement.calibratedValue,
    unit: measurement.unit,
    formattedValue: formatted,
  };
}

/* ──────────────────────── Snap & Grid Helpers ──────────────────────── */

/**
 * Snap a point to a grid.
 */
export function snapToGrid(point: Point2D, gridSize: number): Point2D {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

/**
 * Constrain angle to nearest 15° increment (for Shift-held lines).
 */
export function constrainAngle(
  start: Point2D,
  end: Point2D,
  increment: number = 15,
): Point2D {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx);
  const snappedAngle =
    Math.round(angle / ((increment * Math.PI) / 180)) *
    ((increment * Math.PI) / 180);
  return {
    x: start.x + distance * Math.cos(snappedAngle),
    y: start.y + distance * Math.sin(snappedAngle),
  };
}

/**
 * Check if a point is near another point (within threshold).
 */
export function isNearPoint(
  a: Point2D,
  b: Point2D,
  threshold: number = 5,
): boolean {
  return distanceBetween(a, b) <= threshold;
}
