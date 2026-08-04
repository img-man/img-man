// SPDX-License-Identifier: Apache-2.0
/**
 * Stamp Engine — Phase 3, Week 10
 *
 * Creates stamp annotations (predefined, custom text, custom image, date).
 * Provides factory functions to place stamps on the canvas.
 */

import type { StampAnnotation, StampConfig, PageMeta } from '../types';
import { generateAnnotationId } from './annotation-serializer';
import { STAMP_PRESETS } from '../constants';

/* ──────────────────────── Stamp Factory ──────────────────────── */

/**
 * Create a stamp annotation from a StampConfig.
 *
 * @param page - 1-based page number
 * @param config - Stamp configuration
 * @param pageMeta - Page metadata for centering
 * @returns StampAnnotation ready to be placed on canvas
 */
export function createStampAnnotation(
  page: number,
  config: StampConfig,
  pageMeta?: PageMeta,
): StampAnnotation {
  // Estimate dimensions based on label and font size
  const estWidth = Math.max(config.label.length * config.fontSize * 0.7, 100);
  const estHeight = config.fontSize * 2;

  // Center on page if metadata available
  const x = pageMeta ? (pageMeta.width - estWidth) / 2 : 100;
  const y = pageMeta ? (pageMeta.height - estHeight) / 2 : 100;

  return {
    id: generateAnnotationId(),
    kind: 'stamp',
    page,
    x,
    y,
    width: estWidth,
    height: estHeight,
    rotation: config.rotation,
    opacity: config.opacity,
    locked: false,
    visible: true,
    stampType: config.type,
    label: config.label,
    color: config.color,
    fontSize: config.fontSize,
    imageSrc: config.imageSrc,
  };
}

/**
 * Create a predefined stamp by ID (e.g., 'approved', 'draft').
 * Falls back to the first preset if not found.
 */
export function createPredefinedStamp(
  stampId: string,
  page: number,
  pageMeta?: PageMeta,
): StampAnnotation {
  const preset =
    STAMP_PRESETS.find(
      (s) => s.label.toLowerCase() === stampId.toLowerCase(),
    ) ?? STAMP_PRESETS[0];

  return createStampAnnotation(page, preset, pageMeta);
}

/**
 * Create a custom text stamp.
 */
export function createCustomTextStamp(
  page: number,
  label: string,
  color: string,
  fontSize: number,
  pageMeta?: PageMeta,
): StampAnnotation {
  return createStampAnnotation(
    page,
    {
      type: 'custom-text',
      label,
      color,
      fontSize,
      opacity: 0.8,
      rotation: 0,
    },
    pageMeta,
  );
}

/**
 * Create a date stamp with the current date.
 */
export function createDateStamp(
  page: number,
  color: string,
  fontSize: number,
  pageMeta?: PageMeta,
): StampAnnotation {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return createStampAnnotation(
    page,
    {
      type: 'date',
      label: dateStr,
      color,
      fontSize,
      opacity: 0.9,
      rotation: 0,
    },
    pageMeta,
  );
}

/**
 * Create an image stamp from a data URL.
 */
export function createImageStamp(
  page: number,
  imageSrc: string,
  width: number,
  height: number,
  pageMeta?: PageMeta,
): StampAnnotation {
  const x = pageMeta ? (pageMeta.width - width) / 2 : 100;
  const y = pageMeta ? (pageMeta.height - height) / 2 : 100;

  return {
    id: generateAnnotationId(),
    kind: 'stamp',
    page,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 0.9,
    locked: false,
    visible: true,
    stampType: 'custom-image',
    label: 'Image Stamp',
    color: '#000000',
    fontSize: 12,
    imageSrc,
  };
}

/**
 * Get all available predefined stamp configs.
 */
export function getPredefinedStamps(): StampConfig[] {
  return [...STAMP_PRESETS];
}
