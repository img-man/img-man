// SPDX-License-Identifier: Apache-2.0
/**
 * Fabric Bridge Engine
 *
 * Handles coordinate mapping between screen pixels and PDF points.
 * This is the critical glue between PDF.js (rendering) and Fabric.js (editing).
 *
 * PDF coordinate system: origin at bottom-left, Y goes up, units in points (1pt = 1/72 inch)
 * Screen coordinate system: origin at top-left, Y goes down, units in CSS pixels
 */

import type { CoordinateMapping, PageMeta } from '../types';

/* ──────────────────────── Coordinate Mapping ──────────────────────── */

/**
 * Create a coordinate mapping for a specific page at a specific zoom level.
 *
 * @param pageMeta - Page dimensions in PDF points
 * @param zoom - Current zoom level (1.0 = 100%)
 * @param dpr - Device pixel ratio (default: window.devicePixelRatio)
 * @returns CoordinateMapping object with conversion functions
 */
export function createCoordinateMapping(
  pageMeta: PageMeta,
  zoom: number,
  dpr: number = typeof window !== 'undefined'
    ? window.devicePixelRatio || 1
    : 1,
): CoordinateMapping {
  const scale = zoom; // PDF.js scale matches zoom level

  return {
    /**
     * Convert screen pixel position to PDF point position.
     * Accounts for Y-axis flip (screen top-left → PDF bottom-left).
     */
    screenToPdf(screenX: number, screenY: number) {
      return {
        x: screenX / scale,
        y: screenY / scale, // Keep top-left origin for Fabric objects; pdf-lib flip happens at export
      };
    },

    /**
     * Convert PDF point position to screen pixel position.
     */
    pdfToScreen(pdfX: number, pdfY: number) {
      return {
        x: pdfX * scale,
        y: pdfY * scale,
      };
    },

    scale,
  };
}

/* ──────────────────────── Fabric Object Defaults ──────────────────────── */

/**
 * Default Fabric.js object properties for consistent behavior.
 */
export const FABRIC_OBJECT_DEFAULTS = {
  // Selection appearance
  borderColor: '#8b5cf6',
  cornerColor: '#8b5cf6',
  cornerStyle: 'circle' as const,
  cornerSize: 8,
  transparentCorners: false,
  borderScaleFactor: 2,
  padding: 4,
  // Prevent objects from leaving the canvas
  lockScalingFlip: true,
};

/**
 * Create Fabric.js text object options from our TextAnnotation type.
 */
export function textAnnotationToFabricOptions(
  annotation: {
    text: string;
    fontFamily: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold';
    fontStyle: 'normal' | 'italic';
    textAlign: 'left' | 'center' | 'right';
    color: string;
    opacity: number;
    x: number;
    y: number;
    rotation: number;
  },
  scale: number,
) {
  return {
    text: annotation.text,
    left: annotation.x * scale,
    top: annotation.y * scale,
    fontFamily: annotation.fontFamily,
    fontSize: annotation.fontSize * scale,
    fontWeight: annotation.fontWeight,
    fontStyle: annotation.fontStyle,
    textAlign: annotation.textAlign,
    fill: annotation.color,
    opacity: annotation.opacity,
    angle: annotation.rotation,
    ...FABRIC_OBJECT_DEFAULTS,
  };
}

/**
 * Create Fabric.js image object options from our ImageAnnotation type.
 */
export function imageAnnotationToFabricOptions(
  annotation: {
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
    rotation: number;
    lockAspect?: boolean;
  },
  scale: number,
) {
  return {
    left: annotation.x * scale,
    top: annotation.y * scale,
    scaleX: (annotation.width * scale) / 100, // Will be adjusted when image loads
    scaleY: (annotation.height * scale) / 100,
    opacity: annotation.opacity,
    angle: annotation.rotation,
    lockUniScaling: annotation.lockAspect ?? true,
    ...FABRIC_OBJECT_DEFAULTS,
  };
}

/**
 * Create Fabric.js rectangle options from our ShapeAnnotation type.
 */
export function shapeAnnotationToFabricOptions(
  annotation: {
    x: number;
    y: number;
    width: number;
    height: number;
    fill: string;
    stroke: string;
    strokeWidth: number;
    opacity: number;
    rotation: number;
    borderRadius?: number;
  },
  scale: number,
) {
  return {
    left: annotation.x * scale,
    top: annotation.y * scale,
    width: annotation.width * scale,
    height: annotation.height * scale,
    fill: annotation.fill === 'transparent' ? '' : annotation.fill,
    stroke: annotation.stroke,
    strokeWidth: annotation.strokeWidth,
    opacity: annotation.opacity,
    angle: annotation.rotation,
    rx: (annotation.borderRadius ?? 0) * scale,
    ry: (annotation.borderRadius ?? 0) * scale,
    ...FABRIC_OBJECT_DEFAULTS,
  };
}

/* ──────────────────────── PDF Export Coordinate Conversion ──────────────────────── */

/**
 * Convert a Fabric.js canvas position to pdf-lib draw coordinates.
 * pdf-lib uses bottom-left origin with Y going up.
 *
 * @param fabricLeft - Fabric object left (screen px from top-left)
 * @param fabricTop - Fabric object top (screen px from top-left)
 * @param objectHeight - Object height in screen px
 * @param pageHeight - Page height in PDF points
 * @param scale - Current zoom/scale
 */
export function fabricToPdfLib(
  fabricLeft: number,
  fabricTop: number,
  objectHeight: number,
  pageHeight: number,
  scale: number,
): { x: number; y: number } {
  const pdfX = fabricLeft / scale;
  const pdfY = pageHeight - fabricTop / scale - objectHeight / scale;
  return { x: pdfX, y: pdfY };
}

/**
 * Convert pdf-lib coordinates back to Fabric.js canvas position.
 */
export function pdfLibToFabric(
  pdfX: number,
  pdfY: number,
  objectHeight: number,
  pageHeight: number,
  scale: number,
): { left: number; top: number } {
  return {
    left: pdfX * scale,
    top: (pageHeight - pdfY - objectHeight) * scale,
  };
}
