// SPDX-License-Identifier: Apache-2.0
/**
 * Thumbnail Generator Engine
 *
 * Efficiently generates page thumbnails in batches.
 * Supports caching via data URLs.
 */

import { PageRenderer } from './page-renderer';
import { THUMBNAIL_SCALE } from '../constants';

/* ──────────────────────── Thumbnail Cache ──────────────────────── */

const thumbnailCache = new Map<string, string>(); // `${docId}-${pageNum}` → dataURL

/**
 * Generate a cache key for a thumbnail.
 */
function cacheKey(docId: string, pageNumber: number): string {
  return `${docId}-${pageNumber}`;
}

/**
 * Generate a thumbnail for a single page and return as DataURL.
 */
export async function generateThumbnail(
  renderer: PageRenderer,
  pageNumber: number,
  docId: string = 'default',
  scale: number = THUMBNAIL_SCALE,
): Promise<string> {
  const key = cacheKey(docId, pageNumber);

  // Check cache first
  const cached = thumbnailCache.get(key);
  if (cached) return cached;

  const canvas = await renderer.renderThumbnail(pageNumber, scale);
  const dataUrl = canvas.toDataURL('image/png', 0.7);

  thumbnailCache.set(key, dataUrl);
  return dataUrl;
}

/**
 * Generate thumbnails for a batch of pages.
 * Processes sequentially to avoid overwhelming the main thread.
 *
 * @param renderer - PageRenderer instance
 * @param pageNumbers - Array of page numbers to render
 * @param docId - Unique document identifier for caching
 * @param onProgress - Optional callback for progress updates
 */
export async function generateThumbnailBatch(
  renderer: PageRenderer,
  pageNumbers: number[],
  docId: string = 'default',
  onProgress?: (completed: number, total: number) => void,
): Promise<Map<number, string>> {
  const results = new Map<number, string>();

  for (let i = 0; i < pageNumbers.length; i++) {
    const pageNum = pageNumbers[i];
    const dataUrl = await generateThumbnail(renderer, pageNum, docId);
    results.set(pageNum, dataUrl);

    if (onProgress) {
      onProgress(i + 1, pageNumbers.length);
    }
  }

  return results;
}

/**
 * Clear the thumbnail cache for a document.
 */
export function clearThumbnailCache(docId: string = 'default'): void {
  for (const key of thumbnailCache.keys()) {
    if (key.startsWith(`${docId}-`)) {
      thumbnailCache.delete(key);
    }
  }
}

/**
 * Clear entire thumbnail cache.
 */
export function clearAllThumbnails(): void {
  thumbnailCache.clear();
}
