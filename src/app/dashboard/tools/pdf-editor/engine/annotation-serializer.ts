// SPDX-License-Identifier: Apache-2.0
/**
 * Annotation Serializer Engine
 *
 * Converts between our Annotation types and Fabric.js JSON objects.
 * Enables save/restore of annotation state.
 */

import type {
  Annotation,
  TextAnnotation,
  ImageAnnotation,
  SignatureAnnotation,
  ShapeAnnotation,
  FreehandAnnotation,
  HighlightAnnotation,
  WhiteoutAnnotation,
  UnderlineAnnotation,
  StrikethroughAnnotation,
} from '../types';

/* ──────────────────────── ID Generation ──────────────────────── */

let _idCounter = 0;

export function generateAnnotationId(): string {
  return `ann-${++_idCounter}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/* ──────────────────────── Annotation Factories ──────────────────────── */

export function createTextAnnotation(
  page: number,
  x: number,
  y: number,
  overrides?: Partial<TextAnnotation>,
): TextAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'text',
    page,
    x,
    y,
    width: 200,
    height: 30,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    text: 'New text',
    fontFamily: 'Helvetica',
    fontSize: 16,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'left',
    color: '#000000',
    ...overrides,
  };
}

export function createImageAnnotation(
  page: number,
  x: number,
  y: number,
  src: string,
  overrides?: Partial<ImageAnnotation>,
): ImageAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'image',
    page,
    x,
    y,
    width: 200,
    height: 200,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    src,
    lockAspect: true,
    ...overrides,
  };
}

export function createSignatureAnnotation(
  page: number,
  x: number,
  y: number,
  data: string,
  signatureType: 'drawn' | 'typed' | 'uploaded',
  overrides?: Partial<SignatureAnnotation>,
): SignatureAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'signature',
    page,
    x,
    y,
    width: 200,
    height: 80,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    signatureType,
    data,
    ...overrides,
  };
}

export function createShapeAnnotation(
  page: number,
  x: number,
  y: number,
  shapeType: 'rectangle' | 'ellipse' | 'arrow' | 'line',
  overrides?: Partial<ShapeAnnotation>,
): ShapeAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'shape',
    page,
    x,
    y,
    width: 150,
    height: 100,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    shapeType,
    fill: 'transparent',
    stroke: '#000000',
    strokeWidth: 2,
    borderRadius: 0,
    ...overrides,
  };
}

export function createHighlightAnnotation(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides?: Partial<HighlightAnnotation>,
): HighlightAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'highlight',
    page,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 0.4,
    locked: false,
    visible: true,
    color: '#FFFF00',
    ...overrides,
  };
}

export function createWhiteoutAnnotation(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides?: Partial<WhiteoutAnnotation>,
): WhiteoutAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'whiteout',
    page,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#FFFFFF',
    ...overrides,
  };
}

export function createUnderlineAnnotation(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides?: Partial<UnderlineAnnotation>,
): UnderlineAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'underline',
    page,
    x,
    y,
    width,
    height: height || 2,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#FF0000',
    strokeWidth: 2,
    ...overrides,
  };
}

export function createStrikethroughAnnotation(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  overrides?: Partial<StrikethroughAnnotation>,
): StrikethroughAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'strikethrough',
    page,
    x,
    y,
    width,
    height: height || 2,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    color: '#FF0000',
    strokeWidth: 2,
    ...overrides,
  };
}

export function createFreehandAnnotation(
  page: number,
  x: number,
  y: number,
  path: string,
  bounds: { width: number; height: number },
  overrides?: Partial<FreehandAnnotation>,
): FreehandAnnotation {
  return {
    id: generateAnnotationId(),
    kind: 'freehand',
    page,
    x,
    y,
    width: bounds.width,
    height: bounds.height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    path,
    stroke: '#000000',
    strokeWidth: 2,
    ...overrides,
  };
}

/* ──────────────────────── Serialization ──────────────────────── */

/**
 * Serialize all annotations (across all pages) to JSON.
 * Excludes File objects (not serializable).
 */
export function serializeAnnotations(
  annotations: Map<number, Annotation[]>,
): string {
  const obj: Record<number, Annotation[]> = {};
  for (const [page, anns] of annotations) {
    obj[page] = anns.map((a) => {
      if (a.kind === 'image') {
        // Strip the File object — keep only the src (DataURL)
        const { originalFile, ...rest } = a;
        return rest;
      }
      return a;
    });
  }
  return JSON.stringify(obj);
}

/**
 * Deserialize annotations from JSON back to a Map.
 */
export function deserializeAnnotations(
  json: string,
): Map<number, Annotation[]> {
  const obj = JSON.parse(json) as Record<number, Annotation[]>;
  const map = new Map<number, Annotation[]>();
  for (const [page, anns] of Object.entries(obj)) {
    map.set(Number(page), anns);
  }
  return map;
}
