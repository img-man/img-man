// SPDX-License-Identifier: Apache-2.0
/**
 * curved-text.ts — Curved text (text-on-path) utilities for Design Studio
 *
 * Renders text along a circular arc using SVG <textPath> on a computed
 * arc <path> element. The curve is controlled by a single `curveRadius`
 * parameter:
 *   - 0  → no curve (flat text)
 *   - >0 → arc curving upward (concave)
 *   - <0 → arc curving downward (convex)
 *
 * The radius magnitude controls how tight the curve is:
 * smaller values = tighter curve, larger values = gentler curve.
 *
 * @module curved-text
 */

/* ─── Constants ──────────────────────────────────────────── */

/** Minimum absolute radius to prevent degenerate arcs */
export const MIN_CURVE_RADIUS = 50;

/** Maximum absolute radius (beyond this, curve is visually flat) */
export const MAX_CURVE_RADIUS = 2000;

/** Default step for the curve radius slider */
export const CURVE_RADIUS_STEP = 10;

/* ─── Core Types ─────────────────────────────────────────── */

export interface CurvedTextOptions {
  /** Text content to render */
  text: string;
  /** Curve radius: 0 = flat, positive = up, negative = down */
  curveRadius: number;
  /** Font size in pixels */
  fontSize: number;
  /** Font family name */
  fontFamily: string;
  /** Font weight (e.g. 'normal', 'bold', '700') */
  fontWeight?: string;
  /** Font style (e.g. 'normal', 'italic') */
  fontStyle?: string;
  /** Container width in pixels */
  width: number;
  /** Letter spacing in pixels */
  letterSpacing?: number;
  /** Fill color */
  color?: string;
  /** Text alignment */
  textAlign?: 'left' | 'center' | 'right';
}

/* ─── Arc Geometry ───────────────────────────────────────── */

/**
 * Compute a circular SVG arc path for text to follow.
 *
 * The arc is positioned so its chord spans the container width,
 * centered horizontally. The sweep direction depends on the sign
 * of curveRadius.
 *
 * @returns SVG path `d` attribute string
 */
export function computeArcPath(width: number, curveRadius: number): string {
  const absR = Math.abs(curveRadius);
  // Clamp radius to prevent degenerate arcs
  const r = Math.max(absR, MIN_CURVE_RADIUS);

  // Half the chord length
  const halfChord = width / 2;

  // If radius is too small for the chord, enlarge it
  const effectiveR = Math.max(r, halfChord + 1);

  // Sagitta: distance from chord midpoint to arc midpoint
  const sagitta =
    effectiveR -
    Math.sqrt(Math.max(0, effectiveR * effectiveR - halfChord * halfChord));

  if (curveRadius > 0) {
    // Arc curves upward: start-left → end-right
    // The arc bows upward (large-arc flag = 0, sweep = 1)
    const startX = 0;
    const startY = sagitta;
    const endX = width;
    const endY = sagitta;
    return `M ${startX} ${startY} A ${effectiveR} ${effectiveR} 0 0 1 ${endX} ${endY}`;
  } else {
    // Arc curves downward: start-left → end-right
    // The arc bows downward (large-arc flag = 0, sweep = 0)
    const startX = 0;
    const startY = 0;
    const endX = width;
    const endY = 0;
    return `M ${startX} ${startY} A ${effectiveR} ${effectiveR} 0 0 0 ${endX} ${endY}`;
  }
}

/**
 * Compute the SVG viewBox height needed for a curved text arc.
 * This accounts for the sagitta (arc rise/depth) plus font size padding.
 */
export function computeArcHeight(
  width: number,
  curveRadius: number,
  fontSize: number,
): number {
  const absR = Math.abs(curveRadius);
  const r = Math.max(absR, MIN_CURVE_RADIUS);
  const halfChord = width / 2;
  const effectiveR = Math.max(r, halfChord + 1);
  const sagitta =
    effectiveR -
    Math.sqrt(Math.max(0, effectiveR * effectiveR - halfChord * halfChord));
  // The arc height is sagitta + font size (for descenders/ascenders) + padding
  return sagitta + fontSize * 1.5;
}

/* ─── SVG Rendering ──────────────────────────────────────── */

/**
 * Generate a complete SVG string for curved text.
 *
 * If curveRadius is 0, returns an empty string (caller should render
 * normal flat text instead).
 *
 * @returns SVG markup string or '' if no curve
 */
export function renderCurvedTextSvg(options: CurvedTextOptions): string {
  const {
    text,
    curveRadius,
    fontSize,
    fontFamily,
    fontWeight = 'normal',
    fontStyle = 'normal',
    width,
    letterSpacing = 0,
    color = '#000000',
    textAlign = 'center',
  } = options;

  // No curve → no SVG needed
  if (curveRadius === 0) return '';
  if (!text.trim()) return '';

  const arcPath = computeArcPath(width, curveRadius);
  const svgHeight = computeArcHeight(width, curveRadius, fontSize);

  // Text anchor based on alignment
  const textAnchor =
    textAlign === 'left' ? 'start' : textAlign === 'right' ? 'end' : 'middle';

  // startOffset positions within the path
  const startOffset =
    textAlign === 'left' ? '0%' : textAlign === 'right' ? '100%' : '50%';

  // Unique path ID (timestamp-based to avoid collisions in DOM)
  const pathId = `curved-text-path-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const escapedText = escapeXml(text);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.ceil(svgHeight)}" viewBox="0 0 ${width} ${Math.ceil(svgHeight)}">`,
    `  <defs>`,
    `    <path id="${pathId}" d="${arcPath}" fill="none" />`,
    `  </defs>`,
    `  <text`,
    `    font-family="${escapeXml(fontFamily)}"`,
    `    font-size="${fontSize}"`,
    `    font-weight="${fontWeight}"`,
    `    font-style="${fontStyle}"`,
    `    fill="${escapeXml(color)}"`,
    `    letter-spacing="${letterSpacing}"`,
    `    text-anchor="${textAnchor}"`,
    `  >`,
    `    <textPath href="#${pathId}" startOffset="${startOffset}">`,
    `      ${escapedText}`,
    `    </textPath>`,
    `  </text>`,
    `</svg>`,
  ].join('\n');
}

/* ─── SVG Data URI ───────────────────────────────────────── */

/**
 * Convert curved text SVG to a data URI suitable for use as an
 * image source (e.g., canvas `drawImage` or CSS `background-image`).
 */
export function curvedTextToDataUri(options: CurvedTextOptions): string {
  const svg = renderCurvedTextSvg(options);
  if (!svg) return '';
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* ─── Helpers ────────────────────────────────────────────── */

/**
 * Clamp a curve radius value to valid bounds.
 * Returns 0 if the input is within the "flat zone" (|value| < MIN_CURVE_RADIUS / 2).
 */
export function clampCurveRadius(value: number): number {
  if (Math.abs(value) < MIN_CURVE_RADIUS / 2) return 0;
  const sign = value > 0 ? 1 : -1;
  const clamped = Math.min(Math.abs(value), MAX_CURVE_RADIUS);
  return sign * Math.max(clamped, MIN_CURVE_RADIUS);
}

/**
 * Check if a curve radius value represents a meaningful curve.
 */
export function isCurved(curveRadius: number | undefined): boolean {
  return curveRadius !== undefined && curveRadius !== 0;
}

/** Escape special XML characters in text content */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
