// SPDX-License-Identifier: Apache-2.0
/**
 * Advanced Annotation Engine — Sprint 12
 *
 * Adds three annotation types not yet in the codebase:
 * 1. Callout Bubble — speech/thought bubbles with leader line & text
 * 2. Polygon — arbitrary N-sided polygon shapes (triangle, pentagon, star, etc.)
 * 3. Polyline — open multi-segment lines
 *
 * These extend the existing AnnotationKind system and integrate with
 * the Fabric.js canvas bridge for on-canvas rendering.
 *
 * @see agent-docs/plans/PDF_EDITOR_MASTER_PLAN.md
 *   - Phase 3, A10 (Polygon)
 *   - Phase 3, A11 (Callout bubble)
 */

/* ──────────────────────── Types ──────────────────────── */

export interface Point2D {
  x: number;
  y: number;
}

/** Callout style variants */
export type CalloutStyle = 'rounded' | 'square' | 'cloud' | 'thought';
/** Leader line end style */
export type LeaderEndStyle = 'arrow' | 'dot' | 'none';

/** Polygon preset shapes */
export type PolygonPreset =
  | 'triangle'
  | 'pentagon'
  | 'hexagon'
  | 'octagon'
  | 'star-5'
  | 'star-6'
  | 'star-8'
  | 'diamond'
  | 'cross'
  | 'custom';

/* ──────────────────────── Callout Annotation ──────────────────────── */

export interface CalloutAnnotation {
  id: string;
  kind: 'callout';
  page: number;
  /** Bubble position */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Leader line anchor (where the "speech tip" points to) */
  leaderPoint: Point2D;
  /** Text content */
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textColor: string;
  /** Bubble styling */
  style: CalloutStyle;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  /** Leader line properties */
  leaderEndStyle: LeaderEndStyle;
  /** Opacity */
  opacity: number;
  rotation: number;
  locked: boolean;
  visible: boolean;
}

/* ──────────────────────── Polygon Annotation ──────────────────────── */

export interface PolygonAnnotation {
  id: string;
  kind: 'polygon';
  page: number;
  /** Bounding box center */
  x: number;
  y: number;
  /** Ordered vertices */
  vertices: Point2D[];
  /** Fill color (hex or 'transparent') */
  fill: string;
  /** Stroke color */
  stroke: string;
  strokeWidth: number;
  /** Dash pattern */
  dashPattern: number[];
  /** Preset shape name */
  preset: PolygonPreset;
  /** Opacity */
  opacity: number;
  rotation: number;
  locked: boolean;
  visible: boolean;
}

/* ──────────────────────── Polyline Annotation ──────────────────────── */

export interface PolylineAnnotation {
  id: string;
  kind: 'polyline';
  page: number;
  x: number;
  y: number;
  /** Ordered points */
  points: Point2D[];
  stroke: string;
  strokeWidth: number;
  dashPattern: number[];
  /** End markers */
  startMarker: LeaderEndStyle;
  endMarker: LeaderEndStyle;
  opacity: number;
  locked: boolean;
  visible: boolean;
}

/* ──────────────────────── Constants ──────────────────────── */

export const DEFAULT_CALLOUT: Pick<
  CalloutAnnotation,
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'fontStyle'
  | 'textColor'
  | 'style'
  | 'backgroundColor'
  | 'borderColor'
  | 'borderWidth'
  | 'borderRadius'
  | 'leaderEndStyle'
  | 'opacity'
  | 'rotation'
  | 'locked'
  | 'visible'
> = {
  fontFamily: 'Helvetica',
  fontSize: 14,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textColor: '#000000',
  style: 'rounded',
  backgroundColor: '#fffde7',
  borderColor: '#f59e0b',
  borderWidth: 2,
  borderRadius: 8,
  leaderEndStyle: 'arrow',
  opacity: 1,
  rotation: 0,
  locked: false,
  visible: true,
};

export const DEFAULT_POLYGON: Pick<
  PolygonAnnotation,
  | 'fill'
  | 'stroke'
  | 'strokeWidth'
  | 'dashPattern'
  | 'preset'
  | 'opacity'
  | 'rotation'
  | 'locked'
  | 'visible'
> = {
  fill: 'transparent',
  stroke: '#000000',
  strokeWidth: 2,
  dashPattern: [],
  preset: 'custom',
  opacity: 1,
  rotation: 0,
  locked: false,
  visible: true,
};

export const DEFAULT_POLYLINE: Pick<
  PolylineAnnotation,
  | 'stroke'
  | 'strokeWidth'
  | 'dashPattern'
  | 'startMarker'
  | 'endMarker'
  | 'opacity'
  | 'locked'
  | 'visible'
> = {
  stroke: '#000000',
  strokeWidth: 2,
  dashPattern: [],
  startMarker: 'none',
  endMarker: 'arrow',
  opacity: 1,
  locked: false,
  visible: true,
};

export const CALLOUT_STYLES: CalloutStyle[] = [
  'rounded',
  'square',
  'cloud',
  'thought',
];
export const POLYGON_PRESETS: PolygonPreset[] = [
  'triangle',
  'pentagon',
  'hexagon',
  'octagon',
  'star-5',
  'star-6',
  'star-8',
  'diamond',
  'cross',
  'custom',
];

/* ──────────────────────── ID Counters ──────────────────────── */

let _calloutCounter = 0;
let _polygonCounter = 0;
let _polylineCounter = 0;

export function resetAdvancedCounters(): void {
  _calloutCounter = 0;
  _polygonCounter = 0;
  _polylineCounter = 0;
}

/* ──────────────────────── Callout CRUD ──────────────────────── */

/**
 * Create a new callout annotation.
 */
export function createCallout(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  leaderPoint: Point2D,
  text: string,
  options: Partial<
    Omit<
      CalloutAnnotation,
      | 'id'
      | 'kind'
      | 'page'
      | 'x'
      | 'y'
      | 'width'
      | 'height'
      | 'leaderPoint'
      | 'text'
    >
  > = {},
): CalloutAnnotation {
  _calloutCounter++;
  return {
    id: `callout-${Date.now()}-${_calloutCounter}`,
    kind: 'callout',
    page,
    x,
    y,
    width: Math.max(width, 40),
    height: Math.max(height, 30),
    leaderPoint,
    text,
    ...DEFAULT_CALLOUT,
    ...options,
  };
}

/**
 * Update callout text.
 */
export function updateCalloutText(
  callout: CalloutAnnotation,
  text: string,
): CalloutAnnotation {
  return { ...callout, text };
}

/**
 * Move leader point to a new position.
 */
export function moveLeaderPoint(
  callout: CalloutAnnotation,
  point: Point2D,
): CalloutAnnotation {
  return { ...callout, leaderPoint: point };
}

/**
 * Generate SVG path for a callout bubble with leader line.
 * Uses a bezier-curved leader from the bubble base to the anchor point.
 */
export function generateCalloutPath(callout: CalloutAnnotation): string {
  const { x, y, width, height, leaderPoint, borderRadius: r, style } = callout;
  const hw = width / 2;
  const hh = height / 2;
  const cx = x + hw;
  const cy = y + hh;

  // Determine leader attachment point on the bubble edge
  const dx = leaderPoint.x - cx;
  const dy = leaderPoint.y - cy;
  const angle = Math.atan2(dy, dx);

  // Leader base width
  const baseW = Math.min(20, width / 4);

  // Base attachment at bubble edge
  const attachX = cx + Math.cos(angle) * hw * 0.8;
  const attachY = cy + Math.sin(angle) * hh * 0.8;

  // Perpendicular offset for base width
  const perpX = (-Math.sin(angle) * baseW) / 2;
  const perpY = (Math.cos(angle) * baseW) / 2;

  if (style === 'square') {
    // Simple rectangle + triangle leader
    return [
      `M ${x + r} ${y}`,
      `L ${x + width - r} ${y}`,
      `Q ${x + width} ${y} ${x + width} ${y + r}`,
      `L ${x + width} ${y + height - r}`,
      `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
      `L ${x + r} ${y + height}`,
      `Q ${x} ${y + height} ${x} ${y + height - r}`,
      `L ${x} ${y + r}`,
      `Q ${x} ${y} ${x + r} ${y}`,
      `Z`,
      // Leader triangle
      `M ${attachX + perpX} ${attachY + perpY}`,
      `L ${leaderPoint.x} ${leaderPoint.y}`,
      `L ${attachX - perpX} ${attachY - perpY}`,
      `Z`,
    ].join(' ');
  }

  // Rounded (default path for 'rounded', 'cloud', 'thought')
  return [
    `M ${x + r} ${y}`,
    `L ${x + width - r} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + r}`,
    `L ${x + width} ${y + height - r}`,
    `Q ${x + width} ${y + height} ${x + width - r} ${y + height}`,
    `L ${x + r} ${y + height}`,
    `Q ${x} ${y + height} ${x} ${y + height - r}`,
    `L ${x} ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `Z`,
    // Curved leader
    `M ${attachX + perpX} ${attachY + perpY}`,
    `Q ${(attachX + leaderPoint.x) / 2 + perpX} ${(attachY + leaderPoint.y) / 2 + perpY} ${leaderPoint.x} ${leaderPoint.y}`,
    `Q ${(attachX + leaderPoint.x) / 2 - perpX} ${(attachY + leaderPoint.y) / 2 - perpY} ${attachX - perpX} ${attachY - perpY}`,
    `Z`,
  ].join(' ');
}

/**
 * Compute callout bounds including the leader line.
 */
export function getCalloutBounds(callout: CalloutAnnotation): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const minX = Math.min(callout.x, callout.leaderPoint.x);
  const minY = Math.min(callout.y, callout.leaderPoint.y);
  const maxX = Math.max(callout.x + callout.width, callout.leaderPoint.x);
  const maxY = Math.max(callout.y + callout.height, callout.leaderPoint.y);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/* ──────────────────────── Polygon CRUD ──────────────────────── */

/**
 * Generate vertices for a regular polygon preset.
 * Center at (cx, cy), fitting within radius r.
 */
export function generatePresetVertices(
  preset: PolygonPreset,
  cx: number,
  cy: number,
  radius: number,
): Point2D[] {
  switch (preset) {
    case 'triangle':
      return regularPolygon(cx, cy, radius, 3);
    case 'pentagon':
      return regularPolygon(cx, cy, radius, 5);
    case 'hexagon':
      return regularPolygon(cx, cy, radius, 6);
    case 'octagon':
      return regularPolygon(cx, cy, radius, 8);
    case 'star-5':
      return starPolygon(cx, cy, radius, 5);
    case 'star-6':
      return starPolygon(cx, cy, radius, 6);
    case 'star-8':
      return starPolygon(cx, cy, radius, 8);
    case 'diamond':
      return [
        { x: cx, y: cy - radius },
        { x: cx + radius, y: cy },
        { x: cx, y: cy + radius },
        { x: cx - radius, y: cy },
      ];
    case 'cross':
      return crossPolygon(cx, cy, radius);
    case 'custom':
      // Custom returns nothing — user draws manually
      return [];
  }
}

/**
 * Generate vertices for a regular N-sided polygon.
 * First vertex at top (−π/2 rotation).
 */
export function regularPolygon(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
): Point2D[] {
  const points: Point2D[] = [];
  const angleStep = (2 * Math.PI) / sides;
  const startAngle = -Math.PI / 2; // Start at top
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + i * angleStep;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Generate vertices for a star polygon.
 * Alternates between outer radius and inner radius (outer * 0.4).
 */
export function starPolygon(
  cx: number,
  cy: number,
  radius: number,
  numPoints: number,
): Point2D[] {
  const points: Point2D[] = [];
  const innerRadius = radius * 0.4;
  const totalPoints = numPoints * 2;
  const angleStep = (2 * Math.PI) / totalPoints;
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < totalPoints; i++) {
    const angle = startAngle + i * angleStep;
    const r = i % 2 === 0 ? radius : innerRadius;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Generate vertices for a cross/plus shape.
 * Creates a 12-point polygon forming a cross.
 */
export function crossPolygon(
  cx: number,
  cy: number,
  radius: number,
): Point2D[] {
  const arm = radius * 0.35; // Arm half-width
  return [
    { x: cx - arm, y: cy - radius },
    { x: cx + arm, y: cy - radius },
    { x: cx + arm, y: cy - arm },
    { x: cx + radius, y: cy - arm },
    { x: cx + radius, y: cy + arm },
    { x: cx + arm, y: cy + arm },
    { x: cx + arm, y: cy + radius },
    { x: cx - arm, y: cy + radius },
    { x: cx - arm, y: cy + arm },
    { x: cx - radius, y: cy + arm },
    { x: cx - radius, y: cy - arm },
    { x: cx - arm, y: cy - arm },
  ];
}

/**
 * Create a new polygon annotation.
 */
export function createPolygon(
  page: number,
  vertices: Point2D[],
  options: Partial<
    Omit<PolygonAnnotation, 'id' | 'kind' | 'page' | 'vertices' | 'x' | 'y'>
  > = {},
): PolygonAnnotation {
  if (vertices.length < 3)
    throw new Error('Polygon requires at least 3 vertices');

  const center = polygonCenter(vertices);
  _polygonCounter++;

  return {
    id: `polygon-${Date.now()}-${_polygonCounter}`,
    kind: 'polygon',
    page,
    x: center.x,
    y: center.y,
    vertices,
    ...DEFAULT_POLYGON,
    ...options,
  };
}

/**
 * Create a polygon from a preset shape.
 */
export function createPresetPolygon(
  page: number,
  preset: PolygonPreset,
  cx: number,
  cy: number,
  radius: number,
  options: Partial<
    Omit<
      PolygonAnnotation,
      'id' | 'kind' | 'page' | 'vertices' | 'x' | 'y' | 'preset'
    >
  > = {},
): PolygonAnnotation {
  const vertices = generatePresetVertices(preset, cx, cy, radius);
  if (vertices.length < 3)
    throw new Error(`Preset "${preset}" did not produce enough vertices`);
  _polygonCounter++;
  return {
    id: `polygon-${Date.now()}-${_polygonCounter}`,
    kind: 'polygon',
    page,
    x: cx,
    y: cy,
    vertices,
    ...DEFAULT_POLYGON,
    preset,
    ...options,
  };
}

/**
 * Compute center of a polygon (centroid).
 */
export function polygonCenter(vertices: Point2D[]): Point2D {
  if (vertices.length === 0) return { x: 0, y: 0 };
  const sum = vertices.reduce((a, v) => ({ x: a.x + v.x, y: a.y + v.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / vertices.length, y: sum.y / vertices.length };
}

/**
 * Compute bounding box of a polygon.
 */
export function polygonBounds(vertices: Point2D[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (vertices.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const v of vertices) {
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Convert polygon vertices to an SVG polygon points string.
 */
export function verticesToSvgPoints(vertices: Point2D[]): string {
  return vertices.map((v) => `${v.x},${v.y}`).join(' ');
}

/**
 * Scale polygon vertices from a center point.
 */
export function scaleVertices(
  vertices: Point2D[],
  scale: number,
  center?: Point2D,
): Point2D[] {
  const c = center ?? polygonCenter(vertices);
  return vertices.map((v) => ({
    x: c.x + (v.x - c.x) * scale,
    y: c.y + (v.y - c.y) * scale,
  }));
}

/**
 * Rotate polygon vertices around a center point.
 */
export function rotateVertices(
  vertices: Point2D[],
  angleDeg: number,
  center?: Point2D,
): Point2D[] {
  const c = center ?? polygonCenter(vertices);
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return vertices.map((v) => {
    const dx = v.x - c.x;
    const dy = v.y - c.y;
    return {
      x: c.x + dx * cos - dy * sin,
      y: c.y + dx * sin + dy * cos,
    };
  });
}

/**
 * Check if a point is inside a polygon (ray-casting algorithm).
 */
export function pointInPolygon(point: Point2D, vertices: Point2D[]): boolean {
  let inside = false;
  const n = vertices.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x,
      yi = vertices[i].y;
    const xj = vertices[j].x,
      yj = vertices[j].y;
    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/* ──────────────────────── Polyline CRUD ──────────────────────── */

/**
 * Create a new polyline annotation.
 */
export function createPolyline(
  page: number,
  points: Point2D[],
  options: Partial<
    Omit<PolylineAnnotation, 'id' | 'kind' | 'page' | 'points' | 'x' | 'y'>
  > = {},
): PolylineAnnotation {
  if (points.length < 2) throw new Error('Polyline requires at least 2 points');
  const center = polygonCenter(points);
  _polylineCounter++;
  return {
    id: `polyline-${Date.now()}-${_polylineCounter}`,
    kind: 'polyline',
    page,
    x: center.x,
    y: center.y,
    points,
    ...DEFAULT_POLYLINE,
    ...options,
  };
}

/**
 * Convert polyline points to an SVG path 'd' string.
 */
export function pointsToSvgPath(points: Point2D[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  return (
    `M ${first.x} ${first.y} ` + rest.map((p) => `L ${p.x} ${p.y}`).join(' ')
  );
}

/**
 * Compute total length of a polyline.
 */
export function polylineLength(points: Point2D[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}
