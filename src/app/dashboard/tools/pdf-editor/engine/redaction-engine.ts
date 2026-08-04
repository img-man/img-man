// SPDX-License-Identifier: Apache-2.0
/**
 * Redaction Engine — Phase 4, Week 13
 *
 * Manages redaction marks on PDF pages. Two-step process:
 * 1. MARK: User selects areas to redact (shown as semi-transparent red overlays)
 * 2. APPLY: Permanently removes content under marked areas and replaces with fill
 *
 * Applied redactions are irreversible — they burn through all layers.
 */

import type { RedactionAnnotation, RedactionMark, PageMeta } from '../types';
import {
  DEFAULT_REDACTION_FILL,
  REDACTION_MARK_BORDER,
  REDACTION_MARK_FILL,
} from '../constants';

/* ──────────────────────── Redaction Mark Creation ──────────────────────── */

let _markCounter = 0;

/**
 * Create a new redaction mark (unapplied annotation).
 */
export function createRedactionMark(
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
  options: { fillColor?: string; overlayText?: string } = {},
): RedactionAnnotation {
  _markCounter++;
  return {
    id: `redaction-${Date.now()}-${_markCounter}`,
    kind: 'redaction',
    page,
    x,
    y,
    width,
    height,
    rotation: 0,
    opacity: 1,
    locked: false,
    visible: true,
    name: `Redaction ${_markCounter}`,
    fillColor: options.fillColor ?? DEFAULT_REDACTION_FILL,
    overlayText: options.overlayText,
    applied: false,
  };
}

/**
 * Mark a redaction annotation as applied (burned).
 * Returns a new annotation object with applied=true.
 */
export function markAsApplied(
  annotation: RedactionAnnotation,
): RedactionAnnotation {
  return {
    ...annotation,
    applied: true,
    locked: true, // Can't move after applying
  };
}

/* ──────────────────────── Redaction Mark Conversion ──────────────────────── */

/**
 * Convert a RedactionAnnotation to a simpler RedactionMark for processing.
 */
export function annotationToMark(
  annotation: RedactionAnnotation,
): RedactionMark {
  return {
    id: annotation.id,
    page: annotation.page,
    x: annotation.x,
    y: annotation.y,
    width: annotation.width,
    height: annotation.height,
    fillColor: annotation.fillColor,
    overlayText: annotation.overlayText,
  };
}

/**
 * Get all unapplied redaction marks from a list of annotations.
 */
export function getUnappliedRedactions(
  annotations: RedactionAnnotation[],
): RedactionAnnotation[] {
  return annotations.filter((a) => !a.applied);
}

/**
 * Get all applied redaction marks from a list of annotations.
 */
export function getAppliedRedactions(
  annotations: RedactionAnnotation[],
): RedactionAnnotation[] {
  return annotations.filter((a) => a.applied);
}

/* ──────────────────────── Visual Style ──────────────────────── */

/**
 * Get the visual style for a redaction mark (for Fabric.js rendering).
 */
export function getRedactionMarkStyle(applied: boolean): {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDashArray: number[];
  opacity: number;
} {
  if (applied) {
    return {
      fill: DEFAULT_REDACTION_FILL,
      stroke: DEFAULT_REDACTION_FILL,
      strokeWidth: 0,
      strokeDashArray: [],
      opacity: 1,
    };
  }

  return {
    fill: REDACTION_MARK_FILL,
    stroke: REDACTION_MARK_BORDER,
    strokeWidth: 2,
    strokeDashArray: [6, 3],
    opacity: 0.8,
  };
}

/* ──────────────────────── Page-level Helpers ──────────────────────── */

/**
 * Group redaction marks by page number.
 */
export function groupRedactionsByPage(
  marks: RedactionMark[],
): Map<number, RedactionMark[]> {
  const grouped = new Map<number, RedactionMark[]>();
  for (const mark of marks) {
    const existing = grouped.get(mark.page) || [];
    existing.push(mark);
    grouped.set(mark.page, existing);
  }
  return grouped;
}

/**
 * Check if any redaction area overlaps a given region on a page.
 */
export function hasOverlappingRedaction(
  marks: RedactionMark[],
  page: number,
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return marks.some(
    (m) =>
      m.page === page &&
      m.x < x + width &&
      m.x + m.width > x &&
      m.y < y + height &&
      m.y + m.height > y,
  );
}

/**
 * Merge overlapping redaction marks on the same page into larger boxes.
 * Reduces the number of operations needed during burn.
 */
export function mergeOverlappingMarks(marks: RedactionMark[]): RedactionMark[] {
  if (marks.length <= 1) return marks;

  // Sort by x then y
  const sorted = [...marks].sort((a, b) => a.x - b.x || a.y - b.y);
  const merged: RedactionMark[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Check if overlapping
    if (
      current.x < last.x + last.width &&
      current.y < last.y + last.height &&
      current.x + current.width > last.x &&
      current.y + current.height > last.y
    ) {
      // Merge: expand the box
      const newX = Math.min(last.x, current.x);
      const newY = Math.min(last.y, current.y);
      const newRight = Math.max(last.x + last.width, current.x + current.width);
      const newBottom = Math.max(
        last.y + last.height,
        current.y + current.height,
      );

      merged[merged.length - 1] = {
        ...last,
        x: newX,
        y: newY,
        width: newRight - newX,
        height: newBottom - newY,
      };
    } else {
      merged.push(current);
    }
  }

  return merged;
}

/**
 * Validate that a redaction mark is within page bounds.
 */
export function validateRedactionBounds(
  mark: RedactionMark,
  pageMeta: PageMeta,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (mark.x < 0) errors.push('X position is negative');
  if (mark.y < 0) errors.push('Y position is negative');
  if (mark.width <= 0) errors.push('Width must be positive');
  if (mark.height <= 0) errors.push('Height must be positive');
  if (mark.x + mark.width > pageMeta.width)
    errors.push('Mark extends beyond page width');
  if (mark.y + mark.height > pageMeta.height)
    errors.push('Mark extends beyond page height');

  return { valid: errors.length === 0, errors };
}

/**
 * Count total redaction marks by status.
 */
export function countRedactions(annotations: RedactionAnnotation[]): {
  total: number;
  unapplied: number;
  applied: number;
} {
  let unapplied = 0;
  let applied = 0;
  for (const a of annotations) {
    if (a.applied) applied++;
    else unapplied++;
  }
  return { total: annotations.length, unapplied, applied };
}
