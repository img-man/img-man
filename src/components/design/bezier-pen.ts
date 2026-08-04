// SPDX-License-Identifier: Apache-2.0
/**
 * DS-3.1 — Bezier Pen Tool (Bezier Curves)
 *
 * Core geometry helpers and types for editing SVG paths with bezier curves.
 * The UI integration lives in editor.tsx; this module provides the pure
 * computation layer.
 *
 * Features:
 *  • Anchor point model (position + two control handles)
 *  • Smooth ↔ corner point conversion
 *  • Add / remove anchor points on a segment
 *  • Path ↔ SVG `d` string serialization
 *  • Hit-testing for points and segments
 *  • Close-path detection
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** 2-D point */
export interface Vec2 {
  x: number;
  y: number;
}

/**
 * A single anchor on the bezier path.
 *
 * `handleIn`  = control handle arriving at this anchor (relative to `pos`)
 * `handleOut` = control handle leaving this anchor (relative to `pos`)
 *
 * For a corner point the handles move independently.
 * For a smooth point `handleOut = mirror(handleIn)`.
 */
export interface AnchorPoint {
  pos: Vec2;
  handleIn: Vec2;
  handleOut: Vec2;
  type: 'smooth' | 'corner';
}

/** A complete bezier path (open or closed) */
export interface BezierPath {
  anchors: AnchorPoint[];
  closed: boolean;
}

/* ------------------------------------------------------------------ */
/*  Vector helpers                                                     */
/* ------------------------------------------------------------------ */

export function vec(x: number, y: number): Vec2 {
  return { x, y };
}

export const ZERO: Vec2 = { x: 0, y: 0 };

export function vecAdd(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function vecSub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function vecScale(v: Vec2, s: number): Vec2 {
  return { x: v.x * s, y: v.y * s };
}

export function vecLen(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function vecNorm(v: Vec2): Vec2 {
  const l = vecLen(v);
  return l === 0 ? ZERO : { x: v.x / l, y: v.y / l };
}

export function vecDist(a: Vec2, b: Vec2): number {
  return vecLen(vecSub(a, b));
}

/** Mirror a handle across the origin (for smooth point constraint) */
export function mirrorHandle(h: Vec2): Vec2 {
  return { x: -h.x, y: -h.y };
}

/* ------------------------------------------------------------------ */
/*  Anchor point helpers                                               */
/* ------------------------------------------------------------------ */

/** Create a new corner anchor (independent handles, both zero) */
export function cornerAnchor(pos: Vec2): AnchorPoint {
  return { pos, handleIn: ZERO, handleOut: ZERO, type: 'corner' };
}

/** Create a new smooth anchor — handleOut mirrors handleIn */
export function smoothAnchor(pos: Vec2, handleIn: Vec2): AnchorPoint {
  return { pos, handleIn, handleOut: mirrorHandle(handleIn), type: 'smooth' };
}

/**
 * Convert a smooth point to a corner (unlock handles) or vice versa.
 * When converting to smooth, handleOut becomes the mirror of handleIn.
 */
export function togglePointType(p: AnchorPoint): AnchorPoint {
  if (p.type === 'smooth') {
    return { ...p, type: 'corner' };
  }
  return { ...p, handleOut: mirrorHandle(p.handleIn), type: 'smooth' };
}

/* ------------------------------------------------------------------ */
/*  SVG path `d` serialisation                                         */
/* ------------------------------------------------------------------ */

/**
 * Convert a BezierPath to an SVG `d` attribute string.
 * Each segment is a cubic bezier (`C`).
 */
export function pathToD(path: BezierPath): string {
  const { anchors, closed } = path;
  if (anchors.length === 0) return '';
  if (anchors.length === 1) {
    const p = anchors[0].pos;
    return `M ${p.x} ${p.y}`;
  }

  const parts: string[] = [];
  const first = anchors[0];
  parts.push(`M ${first.pos.x} ${first.pos.y}`);

  const count = closed ? anchors.length : anchors.length - 1;
  for (let i = 0; i < count; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % anchors.length];
    const cp1 = vecAdd(a.pos, a.handleOut);
    const cp2 = vecAdd(b.pos, b.handleIn);
    parts.push(
      `C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${b.pos.x} ${b.pos.y}`,
    );
  }

  if (closed) parts.push('Z');
  return parts.join(' ');
}

/**
 * Minimal parser — converts a simple SVG `d` string (M + cubic C segments + optional Z)
 * back into a BezierPath.
 *
 * This is intentionally limited to our own output format.
 * For arbitrary SVG paths a full parser (e.g., `svg-path-parser`) would be needed.
 */
export function dToPath(d: string): BezierPath {
  const anchors: AnchorPoint[] = [];
  const closed = /Z\s*$/i.test(d);

  // Extract all numbers
  const nums = d
    .replace(/[MmCcZz]/g, ' ')
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (nums.length < 2) return { anchors: [], closed: false };

  // First two numbers = M x y
  anchors.push(cornerAnchor({ x: nums[0], y: nums[1] }));

  // Each C command = 6 numbers: cp1x cp1y cp2x cp2y x y
  let idx = 2;
  while (idx + 5 < nums.length) {
    const cp1: Vec2 = { x: nums[idx], y: nums[idx + 1] };
    const cp2: Vec2 = { x: nums[idx + 2], y: nums[idx + 3] };
    const end: Vec2 = { x: nums[idx + 4], y: nums[idx + 5] };

    // Set handleOut on the previous anchor
    const prev = anchors[anchors.length - 1];
    prev.handleOut = vecSub(cp1, prev.pos);

    // Create new anchor with handleIn
    const newAnchor = cornerAnchor(end);
    newAnchor.handleIn = vecSub(cp2, end);
    anchors.push(newAnchor);

    idx += 6;
  }

  return { anchors, closed };
}

/* ------------------------------------------------------------------ */
/*  Hit testing                                                        */
/* ------------------------------------------------------------------ */

/** Distance from a point to the nearest anchor position */
export function hitTestAnchors(
  path: BezierPath,
  point: Vec2,
  threshold = 8,
): { index: number; dist: number } | null {
  let best: { index: number; dist: number } | null = null;
  for (let i = 0; i < path.anchors.length; i++) {
    const d = vecDist(point, path.anchors[i].pos);
    if (d <= threshold && (!best || d < best.dist)) {
      best = { index: i, dist: d };
    }
  }
  return best;
}

/** Distance from a point to the nearest control handle (absolute coords) */
export function hitTestHandles(
  path: BezierPath,
  point: Vec2,
  threshold = 8,
): { anchorIndex: number; handle: 'in' | 'out'; dist: number } | null {
  let best: { anchorIndex: number; handle: 'in' | 'out'; dist: number } | null =
    null;

  for (let i = 0; i < path.anchors.length; i++) {
    const a = path.anchors[i];
    const hIn = vecAdd(a.pos, a.handleIn);
    const hOut = vecAdd(a.pos, a.handleOut);

    const dIn = vecDist(point, hIn);
    if (dIn <= threshold && (!best || dIn < best.dist)) {
      best = { anchorIndex: i, handle: 'in', dist: dIn };
    }
    const dOut = vecDist(point, hOut);
    if (dOut <= threshold && (!best || dOut < best.dist)) {
      best = { anchorIndex: i, handle: 'out', dist: dOut };
    }
  }
  return best;
}

/**
 * Sample a cubic bezier segment at parameter `t ∈ [0,1]`.
 */
export function cubicBezierPoint(
  p0: Vec2,
  cp1: Vec2,
  cp2: Vec2,
  p3: Vec2,
  t: number,
): Vec2 {
  const u = 1 - t;
  return {
    x:
      u * u * u * p0.x +
      3 * u * u * t * cp1.x +
      3 * u * t * t * cp2.x +
      t * t * t * p3.x,
    y:
      u * u * u * p0.y +
      3 * u * u * t * cp1.y +
      3 * u * t * t * cp2.y +
      t * t * t * p3.y,
  };
}

/**
 * Approximate distance from `point` to a cubic bezier segment
 * by sampling `steps` points along the curve.
 */
export function distToSegment(
  path: BezierPath,
  segIndex: number,
  point: Vec2,
  steps = 20,
): number {
  const a = path.anchors[segIndex];
  const b = path.anchors[(segIndex + 1) % path.anchors.length];
  const cp1 = vecAdd(a.pos, a.handleOut);
  const cp2 = vecAdd(b.pos, b.handleIn);
  let minD = Infinity;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = cubicBezierPoint(a.pos, cp1, cp2, b.pos, t);
    minD = Math.min(minD, vecDist(p, point));
  }
  return minD;
}

/**
 * Hit-test all segments of a path.
 * Returns the segment index closest to `point` (within threshold).
 */
export function hitTestSegments(
  path: BezierPath,
  point: Vec2,
  threshold = 6,
): { segIndex: number; dist: number } | null {
  const count = path.closed ? path.anchors.length : path.anchors.length - 1;
  let best: { segIndex: number; dist: number } | null = null;
  for (let i = 0; i < count; i++) {
    const d = distToSegment(path, i, point);
    if (d <= threshold && (!best || d < best.dist)) {
      best = { segIndex: i, dist: d };
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/*  Insert / Remove anchors                                            */
/* ------------------------------------------------------------------ */

/**
 * Insert a new anchor into `path` at the midpoint of segment `segIndex`.
 * Uses de Casteljau subdivision at t = 0.5.
 */
export function insertAnchorAtSegment(
  path: BezierPath,
  segIndex: number,
): BezierPath {
  const anchors = [...path.anchors.map((a) => ({ ...a }))];
  const a = anchors[segIndex];
  const bIdx = (segIndex + 1) % anchors.length;
  const b = anchors[bIdx];

  const cp1 = vecAdd(a.pos, a.handleOut);
  const cp2 = vecAdd(b.pos, b.handleIn);
  const t = 0.5;

  // De Casteljau split
  const p01 = vecAdd(vecScale(a.pos, 1 - t), vecScale(cp1, t));
  const p12 = vecAdd(vecScale(cp1, 1 - t), vecScale(cp2, t));
  const p23 = vecAdd(vecScale(cp2, 1 - t), vecScale(b.pos, t));
  const p012 = vecAdd(vecScale(p01, 1 - t), vecScale(p12, t));
  const p123 = vecAdd(vecScale(p12, 1 - t), vecScale(p23, t));
  const mid = vecAdd(vecScale(p012, 1 - t), vecScale(p123, t));

  // Update existing anchors' handles
  a.handleOut = vecSub(p01, a.pos);
  b.handleIn = vecSub(p23, b.pos);

  // New midpoint anchor
  const newAnchor: AnchorPoint = {
    pos: mid,
    handleIn: vecSub(p012, mid),
    handleOut: vecSub(p123, mid),
    type: 'smooth',
  };

  // Insert after segIndex
  anchors.splice(segIndex + 1, 0, newAnchor);
  return { anchors, closed: path.closed };
}

/**
 * Remove anchor at `index`. If fewer than 2 anchors remain, returns empty path.
 */
export function removeAnchor(path: BezierPath, index: number): BezierPath {
  const newAnchors = path.anchors.filter((_, i) => i !== index);
  if (newAnchors.length < 2) return { anchors: newAnchors, closed: false };
  return { anchors: newAnchors, closed: path.closed };
}

/* ------------------------------------------------------------------ */
/*  Drag handle helper                                                 */
/* ------------------------------------------------------------------ */

/**
 * Move a control handle on `anchors[anchorIndex]`.
 * If the point is smooth, the opposite handle mirrors automatically.
 *
 * `newAbsPos` is the new absolute position of the handle end.
 */
export function moveHandle(
  path: BezierPath,
  anchorIndex: number,
  handleSide: 'in' | 'out',
  newAbsPos: Vec2,
): BezierPath {
  const anchors = path.anchors.map((a) => ({ ...a }));
  const anchor = anchors[anchorIndex];
  const relative = vecSub(newAbsPos, anchor.pos);

  if (handleSide === 'in') {
    anchor.handleIn = relative;
    if (anchor.type === 'smooth') {
      anchor.handleOut = mirrorHandle(relative);
    }
  } else {
    anchor.handleOut = relative;
    if (anchor.type === 'smooth') {
      anchor.handleIn = mirrorHandle(relative);
    }
  }

  return { anchors, closed: path.closed };
}

/**
 * Move an anchor point (and its handles) by `delta`.
 */
export function moveAnchor(
  path: BezierPath,
  anchorIndex: number,
  newPos: Vec2,
): BezierPath {
  const anchors = path.anchors.map((a) => ({ ...a }));
  anchors[anchorIndex] = { ...anchors[anchorIndex], pos: newPos };
  return { anchors, closed: path.closed };
}

/**
 * Check whether `point` is close enough to the first anchor to close the path.
 */
export function isNearFirstAnchor(
  path: BezierPath,
  point: Vec2,
  threshold = 12,
): boolean {
  if (path.anchors.length < 2) return false;
  return vecDist(point, path.anchors[0].pos) <= threshold;
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

export function createEmptyPath(): BezierPath {
  return { anchors: [], closed: false };
}
