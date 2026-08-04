// SPDX-License-Identifier: Apache-2.0
/**
 * Design Studio — Page Manager
 *
 * Pure utility functions for multi-page design management.
 * Handles page CRUD operations: add, duplicate, delete, reorder, rename.
 *
 * These are stateless functions — the caller (editor.tsx or Zustand store)
 * manages the actual pages array state.
 */

import type { DesignPage, DesignElement } from './editor-types';

/* ──────────────────────── ID Generation ──────────────────────── */

let _pageIdCounter = 0;

/** Generate a unique page ID */
export function generatePageId(): string {
  return `page_${Date.now()}_${++_pageIdCounter}`;
}

/** Reset counter (for testing) */
export function resetPageIdCounter(): void {
  _pageIdCounter = 0;
}

/* ──────────────────────── Factory ──────────────────────── */

/**
 * Create a new blank page with default dimensions.
 *
 * @param width - Page width in pixels (default: 800)
 * @param height - Page height in pixels (default: 600)
 * @param background - Background color (default: '#ffffff')
 * @param name - Optional page name
 */
export function createPage(
  width: number = 800,
  height: number = 600,
  background: string = '#ffffff',
  name?: string,
): DesignPage {
  const id = generatePageId();
  return {
    id,
    name: name || `Page ${id.slice(-4)}`,
    width,
    height,
    background,
    elements: [],
  };
}

/* ──────────────────────── CRUD Operations ──────────────────────── */

/**
 * Add a new page at a specific index.
 * Returns the new pages array (immutable — does NOT mutate input).
 *
 * @param pages - Current pages array
 * @param page - Page to insert
 * @param index - Position to insert at (default: end)
 */
export function addPage(
  pages: DesignPage[],
  page: DesignPage,
  index?: number,
): DesignPage[] {
  const insertAt = index ?? pages.length;
  const clampedIndex = Math.max(0, Math.min(insertAt, pages.length));
  return [...pages.slice(0, clampedIndex), page, ...pages.slice(clampedIndex)];
}

/**
 * Duplicate a page (deep clone elements).
 * Returns [newPages, duplicatedPage].
 *
 * @param pages - Current pages array
 * @param pageIndex - Index of page to duplicate
 */
export function duplicatePage(
  pages: DesignPage[],
  pageIndex: number,
): [DesignPage[], DesignPage] {
  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new RangeError(`Invalid page index: ${pageIndex}`);
  }

  const source = pages[pageIndex];
  const clonedElements: DesignElement[] = structuredClone(source.elements).map(
    (el: DesignElement) => ({
      ...el,
      id: `${el.id}_copy_${Date.now()}`,
    }),
  );

  const newPage: DesignPage = {
    id: generatePageId(),
    name: `${source.name} (Copy)`,
    width: source.width,
    height: source.height,
    background: source.background,
    elements: clonedElements,
  };

  const newPages = [
    ...pages.slice(0, pageIndex + 1),
    newPage,
    ...pages.slice(pageIndex + 1),
  ];

  return [newPages, newPage];
}

/**
 * Delete a page by index.
 * Returns [newPages, newCurrentIndex].
 * Prevents deleting the last remaining page.
 *
 * @param pages - Current pages array
 * @param pageIndex - Index of page to delete
 * @param currentIndex - Current active page index
 */
export function deletePage(
  pages: DesignPage[],
  pageIndex: number,
  currentIndex: number,
): [DesignPage[], number] {
  if (pages.length <= 1) {
    throw new Error('Cannot delete the last page');
  }
  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new RangeError(`Invalid page index: ${pageIndex}`);
  }

  const newPages = pages.filter((_, i) => i !== pageIndex);

  // Adjust current index
  let newCurrentIndex = currentIndex;
  if (currentIndex === pageIndex) {
    // Deleted the active page — move to previous or stay at 0
    newCurrentIndex = Math.max(0, pageIndex - 1);
  } else if (currentIndex > pageIndex) {
    // Active page is after deleted — shift back
    newCurrentIndex = currentIndex - 1;
  }

  return [newPages, newCurrentIndex];
}

/**
 * Reorder a page from one position to another.
 * Returns [newPages, newCurrentIndex].
 *
 * @param pages - Current pages array
 * @param fromIndex - Source position
 * @param toIndex - Target position
 * @param currentIndex - Current active page index
 */
export function reorderPage(
  pages: DesignPage[],
  fromIndex: number,
  toIndex: number,
  currentIndex: number,
): [DesignPage[], number] {
  if (fromIndex === toIndex) return [pages, currentIndex];
  if (
    fromIndex < 0 ||
    fromIndex >= pages.length ||
    toIndex < 0 ||
    toIndex >= pages.length
  ) {
    throw new RangeError(`Invalid reorder indices: ${fromIndex} → ${toIndex}`);
  }

  const newPages = [...pages];
  const [moved] = newPages.splice(fromIndex, 1);
  newPages.splice(toIndex, 0, moved);

  // Track the active page through the reorder
  let newCurrentIndex = currentIndex;
  if (currentIndex === fromIndex) {
    newCurrentIndex = toIndex;
  } else if (fromIndex < currentIndex && toIndex >= currentIndex) {
    newCurrentIndex = currentIndex - 1;
  } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
    newCurrentIndex = currentIndex + 1;
  }

  return [newPages, newCurrentIndex];
}

/**
 * Rename a page.
 * Returns new pages array.
 */
export function renamePage(
  pages: DesignPage[],
  pageIndex: number,
  newName: string,
): DesignPage[] {
  if (pageIndex < 0 || pageIndex >= pages.length) {
    throw new RangeError(`Invalid page index: ${pageIndex}`);
  }

  return pages.map((p, i) =>
    i === pageIndex ? { ...p, name: newName.trim() || p.name } : p,
  );
}

/* ──────────────────────── Query Helpers ──────────────────────── */

/**
 * Get total element count across all pages.
 */
export function getTotalElements(pages: DesignPage[]): number {
  return pages.reduce((sum, page) => sum + page.elements.length, 0);
}

/**
 * Find which page index contains a specific element ID.
 * Returns -1 if not found.
 */
export function findPageByElementId(
  pages: DesignPage[],
  elementId: string,
): number {
  return pages.findIndex((p) => p.elements.some((el) => el.id === elementId));
}

/**
 * Initialize pages from a DesignState.
 * If pages array exists, use it. Otherwise, create a single page
 * from the top-level elements + dimensions (backward compatibility).
 */
export function initializePagesFromState(state: {
  width?: number;
  height?: number;
  background?: string;
  elements?: DesignElement[];
  pages?: DesignPage[];
}): DesignPage[] {
  if (state.pages && state.pages.length > 0) {
    return state.pages;
  }

  // Backward compatibility: wrap top-level state as a single page
  return [
    {
      id: generatePageId(),
      name: 'Page 1',
      width: state.width || 800,
      height: state.height || 600,
      background: state.background || '#ffffff',
      elements: state.elements || [],
    },
  ];
}
