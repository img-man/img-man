// SPDX-License-Identifier: Apache-2.0
/**
 * Freehand Drawing Engine
 *
 * Generates smooth Bézier curves from raw pointer input.
 * Uses quadratic Bézier smoothing for natural-looking paths.
 * Supports both drawing and eraser modes.
 */

import { FREEHAND_MIN_DISTANCE, FREEHAND_SMOOTHING } from '../constants';

/* ──────────────────────── Types ──────────────────────── */

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface FreehandPath {
  /** SVG path data string (M ... Q ... L ...) */
  svgPath: string;
  /** Bounding box */
  bounds: { x: number; y: number; width: number; height: number };
  /** Raw points for potential reprocessing */
  points: Point[];
}

/* ──────────────────────── Path Builder ──────────────────────── */

/**
 * Incrementally builds a smooth SVG path from pointer events.
 */
export class FreehandPathBuilder {
  private points: Point[] = [];
  private minDistance: number;
  private smoothing: number;

  constructor(
    minDistance = FREEHAND_MIN_DISTANCE,
    smoothing = FREEHAND_SMOOTHING,
  ) {
    this.minDistance = minDistance;
    this.smoothing = smoothing;
  }

  /** Add a new point to the path. Returns false if point was too close. */
  addPoint(point: Point): boolean {
    if (this.points.length > 0) {
      const last = this.points[this.points.length - 1];
      const dist = Math.hypot(point.x - last.x, point.y - last.y);
      if (dist < this.minDistance) return false;
    }
    this.points.push({ ...point });
    return true;
  }

  /** Get the current point count */
  get length(): number {
    return this.points.length;
  }

  /** Get all collected points */
  getPoints(): Point[] {
    return [...this.points];
  }

  /**
   * Build the final smooth SVG path from recorded points.
   * Uses quadratic Bézier curves for smoothing.
   */
  build(): FreehandPath {
    const pts = this.points;

    if (pts.length === 0) {
      return {
        svgPath: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        points: [],
      };
    }

    if (pts.length === 1) {
      // Single point → draw a tiny circle (via arc)
      const p = pts[0];
      return {
        svgPath: `M ${p.x} ${p.y} L ${p.x + 0.1} ${p.y}`,
        bounds: { x: p.x, y: p.y, width: 1, height: 1 },
        points: [...pts],
      };
    }

    if (pts.length === 2) {
      const [p0, p1] = pts;
      return {
        svgPath: `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`,
        bounds: computeBounds(pts),
        points: [...pts],
      };
    }

    // Smooth Bézier path
    const parts: string[] = [];
    parts.push(`M ${pts[0].x} ${pts[0].y}`);

    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];

      if (i === 0) {
        // First segment — simple line to midpoint
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        parts.push(`L ${midX} ${midY}`);
      } else {
        // Smooth quadratic Bézier through control points
        const midX = (curr.x + next.x) / 2;
        const midY = (curr.y + next.y) / 2;
        // Control point is the current point, end at midpoint
        parts.push(`Q ${curr.x} ${curr.y} ${midX} ${midY}`);
      }
    }

    // Connect to last point
    const last = pts[pts.length - 1];
    parts.push(`L ${last.x} ${last.y}`);

    return {
      svgPath: parts.join(' '),
      bounds: computeBounds(pts),
      points: [...pts],
    };
  }

  /** Reset the builder for a new stroke */
  reset(): void {
    this.points = [];
  }
}

/* ──────────────────────── Eraser Logic ──────────────────────── */

/**
 * Given eraser center point and radius, find which annotation bounding boxes
 * the eraser overlaps with. Returns IDs of annotations to remove.
 */
export function findEraserTargets(
  eraserX: number,
  eraserY: number,
  eraserRadius: number,
  annotations: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>,
): string[] {
  const targets: string[] = [];

  for (const ann of annotations) {
    // Check if circle overlaps rectangle
    const closestX = Math.max(ann.x, Math.min(eraserX, ann.x + ann.width));
    const closestY = Math.max(ann.y, Math.min(eraserY, ann.y + ann.height));
    const dist = Math.hypot(eraserX - closestX, eraserY - closestY);

    if (dist <= eraserRadius) {
      targets.push(ann.id);
    }
  }

  return targets;
}

/* ──────────────────────── SVG Path Utilities ──────────────────────── */

/**
 * Convert an SVG path string to a series of points (for serialization).
 * This is a simplified parser that extracts M, L, Q endpoints.
 */
export function svgPathToPoints(svgPath: string): Point[] {
  const points: Point[] = [];
  const commands = svgPath.match(/[MLQ]\s+[\d.\-\s]+/g);
  if (!commands) return points;

  for (const cmd of commands) {
    const type = cmd[0];
    const nums = cmd.slice(1).trim().split(/\s+/).map(Number);

    switch (type) {
      case 'M':
      case 'L':
        if (nums.length >= 2) points.push({ x: nums[0], y: nums[1] });
        break;
      case 'Q':
        // Quadratic: control + endpoint. We only record the endpoint.
        if (nums.length >= 4) points.push({ x: nums[2], y: nums[3] });
        break;
    }
  }

  return points;
}

/**
 * Scale an SVG path by a factor.
 */
export function scaleSvgPath(svgPath: string, scale: number): string {
  return svgPath.replace(/(-?\d+\.?\d*)/g, (match) =>
    String(parseFloat(match) * scale),
  );
}

/* ──────────────────────── Utility ──────────────────────── */

function computeBounds(points: Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX || 1,
    height: maxY - minY || 1,
  };
}
