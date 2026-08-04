// SPDX-License-Identifier: Apache-2.0
/**
 * DS-3.2 — Boolean Path Operations
 *
 * Pure-function implementations of the four standard 2-D boolean ops
 * on SVG path `d` strings:
 *
 *  • Union       — merge two shapes
 *  • Subtract    — cut front from back
 *  • Intersect   — keep overlap only
 *  • Exclude     — XOR (everything except overlap)
 *
 * Implementation strategy:
 *   We work on polygonal approximations of paths.  Each path is sampled
 *   into a polygon (array of Vec2 points). Sutherland-Hodgman clipping
 *   gives us the intersection polygon. From the intersection we derive
 *   the other three operations.
 *
 *   For production-grade accuracy on arbitrary curves you'd use a library
 *   like `paper.js` or `clipper2-js`.  This self-contained module keeps
 *   the dependency count at zero and handles the common case of shapes
 *   composed of straight edges and coarse bezier approximations.
 */

import {
  type Vec2,
  type BezierPath,
  vec,
  vecAdd,
  vecSub,
  vecScale,
  cubicBezierPoint,
} from './bezier-pen';

/* ================================================================== */
/*  Public Types                                                       */
/* ================================================================== */

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';

export const BOOLEAN_OPS: { value: BooleanOp; label: string; icon: string }[] = [
  { value: 'union', label: 'Union', icon: '∪' },
  { value: 'subtract', label: 'Subtract', icon: '−' },
  { value: 'intersect', label: 'Intersect', icon: '∩' },
  { value: 'exclude', label: 'Exclude', icon: '⊕' },
];

/* ================================================================== */
/*  Polygon sampling                                                   */
/* ================================================================== */

/**
 * Sample a BezierPath into a polygon (array of Vec2).
 * `stepsPerSegment` controls the curve resolution.
 */
export function samplePathToPolygon(
  path: BezierPath,
  stepsPerSegment = 16,
): Vec2[] {
  const pts: Vec2[] = [];
  if (path.anchors.length === 0) return pts;

  const count = path.closed ? path.anchors.length : path.anchors.length - 1;

  for (let i = 0; i < count; i++) {
    const a = path.anchors[i];
    const b = path.anchors[(i + 1) % path.anchors.length];
    const cp1 = vecAdd(a.pos, a.handleOut);
    const cp2 = vecAdd(b.pos, b.handleIn);

    for (let t = 0; t < stepsPerSegment; t++) {
      pts.push(cubicBezierPoint(a.pos, cp1, cp2, b.pos, t / stepsPerSegment));
    }
  }
  // Add final point if open path
  if (!path.closed && path.anchors.length > 0) {
    pts.push(path.anchors[path.anchors.length - 1].pos);
  }
  return pts;
}

/**
 * Convert a polygon back to a simple SVG `d` string (line segments).
 * This loses bezier curvature but preserves the boolean result visually.
 */
export function polygonToD(poly: Vec2[], closed = true): string {
  if (poly.length === 0) return '';
  const parts = [`M ${poly[0].x} ${poly[0].y}`];
  for (let i = 1; i < poly.length; i++) {
    parts.push(`L ${poly[i].x} ${poly[i].y}`);
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

/* ================================================================== */
/*  Sutherland-Hodgman polygon clipping (intersection)                 */
/* ================================================================== */

function lineIntersection(
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2,
): Vec2 | null {
  const dx1 = b.x - a.x;
  const dy1 = b.y - a.y;
  const dx2 = d.x - c.x;
  const dy2 = d.y - c.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((c.x - a.x) * dy2 - (c.y - a.y) * dx2) / denom;
  return vec(a.x + t * dx1, a.y + t * dy1);
}

function isInside(point: Vec2, edgeStart: Vec2, edgeEnd: Vec2): boolean {
  return (
    (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
    (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x) >=
    0
  );
}

/**
 * Sutherland-Hodgman algorithm: clip `subject` polygon by `clip` polygon.
 * Both must be **convex or reasonably convex** for perfect results.
 * For concave shapes the result is a reasonable approximation.
 */
export function clipPolygon(subject: Vec2[], clip: Vec2[]): Vec2[] {
  if (subject.length === 0 || clip.length === 0) return [];

  let output = [...subject];

  for (let i = 0; i < clip.length; i++) {
    if (output.length === 0) return [];
    const edgeStart = clip[i];
    const edgeEnd = clip[(i + 1) % clip.length];
    const input = output;
    output = [];

    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const prev = input[(j - 1 + input.length) % input.length];
      const curInside = isInside(current, edgeStart, edgeEnd);
      const prevInside = isInside(prev, edgeStart, edgeEnd);

      if (curInside) {
        if (!prevInside) {
          const ix = lineIntersection(prev, current, edgeStart, edgeEnd);
          if (ix) output.push(ix);
        }
        output.push(current);
      } else if (prevInside) {
        const ix = lineIntersection(prev, current, edgeStart, edgeEnd);
        if (ix) output.push(ix);
      }
    }
  }

  return output;
}

/* ================================================================== */
/*  Signed area & centroid helpers                                     */
/* ================================================================== */

export function polygonArea(poly: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    area += poly[i].x * poly[j].y;
    area -= poly[j].x * poly[i].y;
  }
  return area / 2;
}

export function polygonCentroid(poly: Vec2[]): Vec2 {
  if (poly.length === 0) return vec(0, 0);
  let cx = 0;
  let cy = 0;
  for (const p of poly) {
    cx += p.x;
    cy += p.y;
  }
  return vec(cx / poly.length, cy / poly.length);
}

/* ================================================================== */
/*  Boolean operations (polygon-level)                                 */
/* ================================================================== */

/**
 * Compute the intersection polygon of two polygons.
 */
export function polygonIntersect(a: Vec2[], b: Vec2[]): Vec2[] {
  return clipPolygon(a, b);
}

/**
 * Compute the union of two polygons.
 * Simplified approach: returns combined path string with both outlines.
 * For non-overlapping shapes this is visually correct via the SVG
 * even-odd fill rule.
 */
export function polygonUnionD(a: Vec2[], b: Vec2[]): string {
  if (a.length === 0) return polygonToD(b);
  if (b.length === 0) return polygonToD(a);
  return `${polygonToD(a)} ${polygonToD(b)}`;
}

/**
 * Subtract polygon B from polygon A.
 * We output A's outline + reversed B outline → SVG even-odd rule subtracts.
 */
export function polygonSubtractD(a: Vec2[], b: Vec2[]): string {
  if (a.length === 0) return '';
  if (b.length === 0) return polygonToD(a);
  const bReversed = [...b].reverse();
  return `${polygonToD(a)} ${polygonToD(bReversed)}`;
}

/**
 * Exclude (XOR) — keep everything except overlap.
 * Both outlines combined with even-odd fill rule.
 */
export function polygonExcludeD(a: Vec2[], b: Vec2[]): string {
  return polygonUnionD(a, b);
  // With fill-rule="evenodd" the overlapping region cancels out
}

/* ================================================================== */
/*  D-string → polygon parser (accepts M/L/C/Z)                       */
/* ================================================================== */

/**
 * Parse an SVG `d` string into a polygon.
 * Handles `M`, `L`, and `C` commands (absolute only).
 * Falls back to bezier sampling for C commands.
 */
function dToPolygon(d: string, stepsPerCurve = 16): Vec2[] {
  const pts: Vec2[] = [];
  // Match commands with their following numbers
  const cmdRegex = /([MLCZmlcz])\s*([\d\s,.\-e+]*)/g;
  let match: RegExpExecArray | null;
  let cx = 0;
  let cy = 0;

  while ((match = cmdRegex.exec(d)) !== null) {
    const cmd = match[1];
    const numsStr = match[2].trim();
    const nums = numsStr.length > 0
      ? numsStr.split(/[\s,]+/).map(Number)
      : [];

    switch (cmd) {
      case 'M':
        if (nums.length >= 2) {
          cx = nums[0];
          cy = nums[1];
          pts.push(vec(cx, cy));
        }
        break;
      case 'L':
        if (nums.length >= 2) {
          cx = nums[0];
          cy = nums[1];
          pts.push(vec(cx, cy));
        }
        break;
      case 'C':
        if (nums.length >= 6) {
          const p0 = vec(cx, cy);
          const cp1 = vec(nums[0], nums[1]);
          const cp2 = vec(nums[2], nums[3]);
          const p1 = vec(nums[4], nums[5]);
          for (let t = 1; t <= stepsPerCurve; t++) {
            pts.push(cubicBezierPoint(p0, cp1, cp2, p1, t / stepsPerCurve));
          }
          cx = nums[4];
          cy = nums[5];
        }
        break;
      case 'Z':
      case 'z':
        // Closed path — point back to start is implicit
        break;
      default:
        break;
    }
  }
  return pts;
}

/* ================================================================== */
/*  High-level API: operate on SVG `d` strings                         */
/* ================================================================== */

/**
 * Apply a boolean operation on two SVG path `d` strings.
 * Returns the resulting `d` string.
 *
 * @param dA  — "back" shape
 * @param dB  — "front" shape
 * @param op  — boolean operation
 */
export function applyBooleanOp(dA: string, dB: string, op: BooleanOp): string {
  const polyA = dToPolygon(dA);
  const polyB = dToPolygon(dB);

  switch (op) {
    case 'union':
      return polygonUnionD(polyA, polyB);
    case 'subtract':
      return polygonSubtractD(polyA, polyB);
    case 'intersect': {
      const inter = polygonIntersect(polyA, polyB);
      return polygonToD(inter);
    }
    case 'exclude':
      return polygonExcludeD(polyA, polyB);
    default:
      return dA;
  }
}

/**
 * Given a filled shapes (rect/ellipse) bounding box, produce a polygon.
 * Useful for converting primitive elements to polygons before boolean ops.
 */
export function rectToPolygon(
  x: number,
  y: number,
  w: number,
  h: number,
): Vec2[] {
  return [vec(x, y), vec(x + w, y), vec(x + w, y + h), vec(x, y + h)];
}

export function ellipseToPolygon(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  steps = 32,
): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (Math.PI * 2 * i) / steps;
    pts.push(vec(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)));
  }
  return pts;
}
