// SPDX-License-Identifier: Apache-2.0
/**
 * Alignment Engine — Phase 3, Week 11
 *
 * Provides alignment, distribution, grouping, and snapping utilities
 * for annotations on the canvas.
 */

import type {
  Annotation,
  AlignDirection,
  DistributeDirection,
  SnapGuide,
  PageMeta,
} from '../types';
import { SNAP_THRESHOLD } from '../constants';

/* ──────────────────────── Alignment ──────────────────────── */

export interface AlignResult {
  id: string;
  x: number;
  y: number;
}

/**
 * Align multiple annotations along a given axis.
 *
 * @param annotations - The annotations to align
 * @param direction - Alignment direction
 * @param pageMeta - Page dimensions for page-relative alignment (when < 2 items)
 * @returns Array of { id, x, y } updates
 */
export function alignAnnotations(
  annotations: Annotation[],
  direction: AlignDirection,
  pageMeta?: PageMeta,
): AlignResult[] {
  if (annotations.length === 0) return [];

  // For single annotation, align to page edges
  const usePageAlign = annotations.length < 2 && !!pageMeta;

  let refValue: number;

  switch (direction) {
    case 'left':
      refValue = usePageAlign ? 0 : Math.min(...annotations.map((a) => a.x));
      return annotations.map((a) => ({ id: a.id, x: refValue, y: a.y }));

    case 'center': {
      if (usePageAlign && pageMeta) {
        return annotations.map((a) => ({
          id: a.id,
          x: (pageMeta.width - a.width) / 2,
          y: a.y,
        }));
      }
      const minX = Math.min(...annotations.map((a) => a.x));
      const maxX = Math.max(...annotations.map((a) => a.x + a.width));
      const center = (minX + maxX) / 2;
      return annotations.map((a) => ({
        id: a.id,
        x: center - a.width / 2,
        y: a.y,
      }));
    }

    case 'right': {
      if (usePageAlign && pageMeta) {
        return annotations.map((a) => ({
          id: a.id,
          x: pageMeta.width - a.width,
          y: a.y,
        }));
      }
      refValue = Math.max(...annotations.map((a) => a.x + a.width));
      return annotations.map((a) => ({
        id: a.id,
        x: refValue - a.width,
        y: a.y,
      }));
    }

    case 'top':
      refValue = usePageAlign ? 0 : Math.min(...annotations.map((a) => a.y));
      return annotations.map((a) => ({ id: a.id, x: a.x, y: refValue }));

    case 'middle': {
      if (usePageAlign && pageMeta) {
        return annotations.map((a) => ({
          id: a.id,
          x: a.x,
          y: (pageMeta.height - a.height) / 2,
        }));
      }
      const minY = Math.min(...annotations.map((a) => a.y));
      const maxY = Math.max(...annotations.map((a) => a.y + a.height));
      const middle = (minY + maxY) / 2;
      return annotations.map((a) => ({
        id: a.id,
        x: a.x,
        y: middle - a.height / 2,
      }));
    }

    case 'bottom': {
      if (usePageAlign && pageMeta) {
        return annotations.map((a) => ({
          id: a.id,
          x: a.x,
          y: pageMeta.height - a.height,
        }));
      }
      refValue = Math.max(...annotations.map((a) => a.y + a.height));
      return annotations.map((a) => ({
        id: a.id,
        x: a.x,
        y: refValue - a.height,
      }));
    }

    default:
      return [];
  }
}

/* ──────────────────────── Distribution ──────────────────────── */

/**
 * Distribute annotations evenly.
 * Need at least 3 annotations for distribution to be meaningful.
 */
export function distributeAnnotations(
  annotations: Annotation[],
  direction: DistributeDirection,
): AlignResult[] {
  if (annotations.length < 3) {
    return annotations.map((a) => ({ id: a.id, x: a.x, y: a.y }));
  }

  const sorted = [...annotations].sort((a, b) => {
    return direction === 'horizontal' ? a.x - b.x : a.y - b.y;
  });

  if (direction === 'horizontal') {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpace = last.x + last.width - first.x;
    const totalWidths = sorted.reduce((sum, a) => sum + a.width, 0);
    const gap = (totalSpace - totalWidths) / (sorted.length - 1);

    let currentX = first.x;
    return sorted.map((a) => {
      const result = { id: a.id, x: currentX, y: a.y };
      currentX += a.width + gap;
      return result;
    });
  } else {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpace = last.y + last.height - first.y;
    const totalHeights = sorted.reduce((sum, a) => sum + a.height, 0);
    const gap = (totalSpace - totalHeights) / (sorted.length - 1);

    let currentY = first.y;
    return sorted.map((a) => {
      const result = { id: a.id, x: a.x, y: currentY };
      currentY += a.height + gap;
      return result;
    });
  }
}

/* ──────────────────────── Snapping ──────────────────────── */

/**
 * Calculate snap guides for a moving annotation.
 * Returns the position adjustments and guides to display.
 */
export function calculateSnap(
  moving: Annotation,
  otherAnnotations: Annotation[],
  pageMeta: PageMeta,
  threshold = SNAP_THRESHOLD,
): { adjustedX: number; adjustedY: number; guides: SnapGuide[] } {
  let adjustedX = moving.x;
  let adjustedY = moving.y;
  const guides: SnapGuide[] = [];

  const movingCenterX = moving.x + moving.width / 2;
  const movingCenterY = moving.y + moving.height / 2;
  const movingRight = moving.x + moving.width;
  const movingBottom = moving.y + moving.height;

  // Page edge snapping
  const pageSnaps = [
    { value: 0, label: 'Left Edge' },
    { value: pageMeta.width / 2, label: 'Center' },
    { value: pageMeta.width, label: 'Right Edge' },
  ];
  const pageYSnaps = [
    { value: 0, label: 'Top Edge' },
    { value: pageMeta.height / 2, label: 'Middle' },
    { value: pageMeta.height, label: 'Bottom Edge' },
  ];

  // Snap X to page
  for (const snap of pageSnaps) {
    if (Math.abs(moving.x - snap.value) < threshold) {
      adjustedX = snap.value;
      guides.push({
        orientation: 'vertical',
        position: snap.value,
        label: snap.label,
      });
      break;
    }
    if (Math.abs(movingCenterX - snap.value) < threshold) {
      adjustedX = snap.value - moving.width / 2;
      guides.push({
        orientation: 'vertical',
        position: snap.value,
        label: snap.label,
      });
      break;
    }
    if (Math.abs(movingRight - snap.value) < threshold) {
      adjustedX = snap.value - moving.width;
      guides.push({
        orientation: 'vertical',
        position: snap.value,
        label: snap.label,
      });
      break;
    }
  }

  // Snap Y to page
  for (const snap of pageYSnaps) {
    if (Math.abs(moving.y - snap.value) < threshold) {
      adjustedY = snap.value;
      guides.push({
        orientation: 'horizontal',
        position: snap.value,
        label: snap.label,
      });
      break;
    }
    if (Math.abs(movingCenterY - snap.value) < threshold) {
      adjustedY = snap.value - moving.height / 2;
      guides.push({
        orientation: 'horizontal',
        position: snap.value,
        label: snap.label,
      });
      break;
    }
    if (Math.abs(movingBottom - snap.value) < threshold) {
      adjustedY = snap.value - moving.height;
      guides.push({
        orientation: 'horizontal',
        position: snap.value,
        label: snap.label,
      });
      break;
    }
  }

  // Snap to other annotations
  for (const other of otherAnnotations) {
    if (other.id === moving.id) continue;

    const otherCenterX = other.x + other.width / 2;
    const otherCenterY = other.y + other.height / 2;
    const otherRight = other.x + other.width;
    const otherBottom = other.y + other.height;

    // Horizontal edge alignment
    const hSnapCandidates = [
      { movingVal: moving.x, snapVal: other.x },
      { movingVal: moving.x, snapVal: otherRight },
      { movingVal: movingRight, snapVal: other.x },
      { movingVal: movingRight, snapVal: otherRight },
      { movingVal: movingCenterX, snapVal: otherCenterX },
    ];

    for (const { movingVal, snapVal } of hSnapCandidates) {
      if (Math.abs(movingVal - snapVal) < threshold) {
        adjustedX = moving.x + (snapVal - movingVal);
        guides.push({ orientation: 'vertical', position: snapVal });
        break;
      }
    }

    // Vertical edge alignment
    const vSnapCandidates = [
      { movingVal: moving.y, snapVal: other.y },
      { movingVal: moving.y, snapVal: otherBottom },
      { movingVal: movingBottom, snapVal: other.y },
      { movingVal: movingBottom, snapVal: otherBottom },
      { movingVal: movingCenterY, snapVal: otherCenterY },
    ];

    for (const { movingVal, snapVal } of vSnapCandidates) {
      if (Math.abs(movingVal - snapVal) < threshold) {
        adjustedY = moving.y + (snapVal - movingVal);
        guides.push({ orientation: 'horizontal', position: snapVal });
        break;
      }
    }
  }

  return { adjustedX, adjustedY, guides };
}

/* ──────────────────────── Z-Order Helpers ──────────────────────── */

/**
 * Reorder annotations for z-index changes: bring forward/backward/to front/to back.
 */
export function reorderZIndex(
  annotations: Annotation[],
  targetId: string,
  direction: 'forward' | 'backward' | 'front' | 'back',
): Annotation[] {
  const idx = annotations.findIndex((a) => a.id === targetId);
  if (idx === -1) return annotations;

  const result = [...annotations];
  const [item] = result.splice(idx, 1);

  switch (direction) {
    case 'forward':
      result.splice(Math.min(idx + 1, result.length), 0, item);
      break;
    case 'backward':
      result.splice(Math.max(idx - 1, 0), 0, item);
      break;
    case 'front':
      result.push(item);
      break;
    case 'back':
      result.unshift(item);
      break;
  }

  return result;
}

/* ──────────────────────── Grouping Helpers ──────────────────────── */

/**
 * Calculate the bounding box of a group of annotations.
 */
export function getGroupBounds(annotations: Annotation[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  if (annotations.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  const minX = Math.min(...annotations.map((a) => a.x));
  const minY = Math.min(...annotations.map((a) => a.y));
  const maxX = Math.max(...annotations.map((a) => a.x + a.width));
  const maxY = Math.max(...annotations.map((a) => a.y + a.height));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Duplicate annotations with offset for paste.
 */
export function duplicateAnnotations(
  annotations: Annotation[],
  offsetX = 20,
  offsetY = 20,
  targetPage?: number,
): Annotation[] {
  return annotations.map((a) => ({
    ...a,
    id: `${a.id}-dup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    x: a.x + offsetX,
    y: a.y + offsetY,
    page: targetPage ?? a.page,
    name: a.name ? `${a.name} (copy)` : undefined,
  }));
}
