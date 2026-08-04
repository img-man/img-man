// SPDX-License-Identifier: Apache-2.0
/**
 * Bookmark Engine — Phase 4, Week 15
 *
 * Manages PDF bookmark/outline tree: parsing from PDF.js,
 * CRUD operations, drag-to-reorder, and serialization back to pdf-lib.
 */

import type { PdfBookmark } from '../types';
import { MAX_BOOKMARK_DEPTH, MAX_BOOKMARKS } from '../constants';

/* ──────────────────────── Bookmark Creation ──────────────────────── */

let _bookmarkCounter = 0;

/**
 * Create a new bookmark.
 */
export function createBookmark(
  title: string,
  page: number,
  yOffset = 0,
  level = 0,
): PdfBookmark {
  _bookmarkCounter++;
  return {
    id: `bm-${Date.now()}-${_bookmarkCounter}`,
    title,
    page,
    yOffset,
    level,
    children: [],
    expanded: true,
  };
}

/**
 * Parse a flat outline array from PDF.js into a hierarchical bookmark tree.
 *
 * PDF.js outline items have: { title, dest, items[] }
 * We convert to our PdfBookmark format.
 */
export function parseOutlineFromPdfJs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outlineItems: any[],
  level = 0,
): PdfBookmark[] {
  if (!outlineItems || outlineItems.length === 0) return [];

  return outlineItems.map((item) => {
    _bookmarkCounter++;
    const bookmark: PdfBookmark = {
      id: `bm-parsed-${_bookmarkCounter}`,
      title: item.title || 'Untitled',
      page: 1, // Will be resolved later via dest
      yOffset: 0,
      level,
      children: item.items ? parseOutlineFromPdfJs(item.items, level + 1) : [],
      expanded: level < 2, // Expand first two levels by default
    };
    return bookmark;
  });
}

/* ──────────────────────── Tree Operations ──────────────────────── */

/**
 * Find a bookmark by ID in the tree (recursive).
 */
export function findBookmark(
  bookmarks: PdfBookmark[],
  id: string,
): PdfBookmark | null {
  for (const bm of bookmarks) {
    if (bm.id === id) return bm;
    const found = findBookmark(bm.children, id);
    if (found) return found;
  }
  return null;
}

/**
 * Find the parent of a bookmark by child ID.
 */
export function findParent(
  bookmarks: PdfBookmark[],
  childId: string,
): { parent: PdfBookmark[] | null; index: number } {
  for (let i = 0; i < bookmarks.length; i++) {
    if (bookmarks[i].id === childId) {
      return { parent: null, index: i }; // root-level
    }
    const found = findParentRecursive(bookmarks[i], childId);
    if (found) return found;
  }
  return { parent: null, index: -1 };
}

function findParentRecursive(
  parent: PdfBookmark,
  childId: string,
): { parent: PdfBookmark[] | null; index: number } | null {
  for (let i = 0; i < parent.children.length; i++) {
    if (parent.children[i].id === childId) {
      return { parent: parent.children, index: i };
    }
    const found = findParentRecursive(parent.children[i], childId);
    if (found) return found;
  }
  return null;
}

/**
 * Add a bookmark at a specific position in the tree.
 * Returns a new tree (immutable).
 */
export function addBookmark(
  bookmarks: PdfBookmark[],
  newBookmark: PdfBookmark,
  parentId?: string,
  insertIndex?: number,
): PdfBookmark[] {
  if (!parentId) {
    // Add at root level
    const result = [...bookmarks];
    const idx = insertIndex ?? result.length;
    result.splice(idx, 0, newBookmark);
    return result;
  }

  return bookmarks.map((bm) => {
    if (bm.id === parentId) {
      const children = [...bm.children];
      const idx = insertIndex ?? children.length;
      children.splice(idx, 0, { ...newBookmark, level: bm.level + 1 });
      return { ...bm, children };
    }
    return {
      ...bm,
      children: addBookmark(bm.children, newBookmark, parentId, insertIndex),
    };
  });
}

/**
 * Remove a bookmark by ID from the tree.
 * Returns a new tree (immutable).
 */
export function removeBookmark(
  bookmarks: PdfBookmark[],
  id: string,
): PdfBookmark[] {
  return bookmarks
    .filter((bm) => bm.id !== id)
    .map((bm) => ({
      ...bm,
      children: removeBookmark(bm.children, id),
    }));
}

/**
 * Update a bookmark's properties.
 * Returns a new tree (immutable).
 */
export function updateBookmark(
  bookmarks: PdfBookmark[],
  id: string,
  update: Partial<Omit<PdfBookmark, 'id' | 'children'>>,
): PdfBookmark[] {
  return bookmarks.map((bm) => {
    if (bm.id === id) {
      return { ...bm, ...update };
    }
    return { ...bm, children: updateBookmark(bm.children, id, update) };
  });
}

/**
 * Move a bookmark to a new position in the tree.
 * Returns a new tree (immutable).
 */
export function moveBookmark(
  bookmarks: PdfBookmark[],
  sourceId: string,
  targetParentId: string | null,
  targetIndex: number,
): PdfBookmark[] {
  const source = findBookmark(bookmarks, sourceId);
  if (!source) return bookmarks;

  // Remove from current position
  let tree = removeBookmark(bookmarks, sourceId);

  // Add to new position
  if (targetParentId) {
    tree = addBookmark(tree, source, targetParentId, targetIndex);
  } else {
    tree = [...tree];
    tree.splice(targetIndex, 0, source);
  }

  // Recalculate levels
  return recalculateLevels(tree, 0);
}

/**
 * Toggle the expanded state of a bookmark.
 */
export function toggleExpanded(
  bookmarks: PdfBookmark[],
  id: string,
): PdfBookmark[] {
  return bookmarks.map((bm) => {
    if (bm.id === id) {
      return { ...bm, expanded: !bm.expanded };
    }
    return { ...bm, children: toggleExpanded(bm.children, id) };
  });
}

/* ──────────────────────── Tree Utilities ──────────────────────── */

/**
 * Recalculate bookmark levels after a move/restructure.
 */
export function recalculateLevels(
  bookmarks: PdfBookmark[],
  currentLevel: number,
): PdfBookmark[] {
  return bookmarks.map((bm) => ({
    ...bm,
    level: currentLevel,
    children: recalculateLevels(bm.children, currentLevel + 1),
  }));
}

/**
 * Flatten the bookmark tree into a flat array (for listing/export).
 */
export function flattenBookmarks(bookmarks: PdfBookmark[]): PdfBookmark[] {
  const result: PdfBookmark[] = [];
  for (const bm of bookmarks) {
    result.push(bm);
    result.push(...flattenBookmarks(bm.children));
  }
  return result;
}

/**
 * Count total bookmarks in the tree.
 */
export function countBookmarks(bookmarks: PdfBookmark[]): number {
  let count = bookmarks.length;
  for (const bm of bookmarks) {
    count += countBookmarks(bm.children);
  }
  return count;
}

/**
 * Get the maximum nesting depth of the tree.
 */
export function getMaxDepth(bookmarks: PdfBookmark[]): number {
  if (bookmarks.length === 0) return 0;
  let maxChild = 0;
  for (const bm of bookmarks) {
    const childDepth = getMaxDepth(bm.children);
    if (childDepth > maxChild) maxChild = childDepth;
  }
  return 1 + maxChild;
}

/**
 * Validate the bookmark tree.
 */
export function validateBookmarkTree(
  bookmarks: PdfBookmark[],
  totalPages: number,
): string[] {
  const errors: string[] = [];
  const total = countBookmarks(bookmarks);

  if (total > MAX_BOOKMARKS) {
    errors.push(`Too many bookmarks (${total}). Maximum is ${MAX_BOOKMARKS}.`);
  }

  const depth = getMaxDepth(bookmarks);
  if (depth > MAX_BOOKMARK_DEPTH) {
    errors.push(
      `Bookmark nesting too deep (${depth} levels). Maximum is ${MAX_BOOKMARK_DEPTH}.`,
    );
  }

  const flat = flattenBookmarks(bookmarks);
  for (const bm of flat) {
    if (bm.page < 1 || bm.page > totalPages) {
      errors.push(`Bookmark "${bm.title}" targets invalid page ${bm.page}.`);
    }
    if (!bm.title.trim()) {
      errors.push(`Bookmark at page ${bm.page} has an empty title.`);
    }
  }

  return errors;
}

/**
 * Sort bookmarks by page number (ascending).
 */
export function sortBookmarksByPage(bookmarks: PdfBookmark[]): PdfBookmark[] {
  return [...bookmarks]
    .sort((a, b) => a.page - b.page)
    .map((bm) => ({
      ...bm,
      children: sortBookmarksByPage(bm.children),
    }));
}
