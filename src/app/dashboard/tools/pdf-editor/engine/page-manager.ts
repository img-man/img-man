// SPDX-License-Identifier: Apache-2.0
/**
 * Page Manager Engine
 *
 * Handles page-level operations on a PDF document using pdf-lib:
 * - Reorder pages (drag-drop)
 * - Delete pages
 * - Insert blank pages
 * - Duplicate pages
 * - Rotate pages (90°, 180°, 270°)
 * - Extract pages as a new PDF
 *
 * All operations work on the raw PDF bytes and return new bytes.
 * This keeps the engine pure (no side effects) and testable.
 */

import { PDFDocument, PageSizes } from 'pdf-lib';
import type { PageMeta, PageSize, PageSizeDimensions } from '../types';
import { PAGE_SIZE_PRESETS } from '../constants';

/* ──────────────────────── Helpers ──────────────────────── */

function getPageSizePts(
  size: PageSize,
  adjacentMeta?: PageMeta,
): [number, number] {
  if (size === 'same-as-adjacent' && adjacentMeta) {
    return [adjacentMeta.width, adjacentMeta.height];
  }
  const preset = PAGE_SIZE_PRESETS[size];
  if (preset) return [preset.width, preset.height];
  // Default to US Letter
  return [PageSizes.Letter[0], PageSizes.Letter[1]];
}

async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { ignoreEncryption: true });
}

function buildPageMetadata(doc: PDFDocument): PageMeta[] {
  const pages = doc.getPages();
  return pages.map((page, i) => {
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;
    return {
      pageNumber: i + 1,
      width,
      height,
      rotation,
    };
  });
}

/* ──────────────────────── Reorder Pages ──────────────────────── */

/**
 * Reorder a page from one position to another.
 * @param bytes Original PDF bytes
 * @param fromIndex 0-based source index
 * @param toIndex 0-based destination index
 * @returns New PDF bytes + updated page metadata
 */
export async function reorderPage(
  bytes: Uint8Array,
  fromIndex: number,
  toIndex: number,
): Promise<{ bytes: Uint8Array; pageMetadata: PageMeta[] }> {
  if (fromIndex === toIndex) {
    const doc = await loadPdf(bytes);
    return { bytes, pageMetadata: buildPageMetadata(doc) };
  }

  const doc = await loadPdf(bytes);
  const pages = doc.getPages();
  const totalPages = pages.length;

  if (
    fromIndex < 0 ||
    fromIndex >= totalPages ||
    toIndex < 0 ||
    toIndex >= totalPages
  ) {
    throw new Error(
      `Invalid page indices: from=${fromIndex}, to=${toIndex}, total=${totalPages}`,
    );
  }

  // pdf-lib doesn't have a native reorder — we create a new document
  const newDoc = await PDFDocument.create();
  const order = Array.from({ length: totalPages }, (_, i) => i);

  // Move element from fromIndex to toIndex
  const [moved] = order.splice(fromIndex, 1);
  order.splice(toIndex, 0, moved);

  const copiedPages = await newDoc.copyPages(doc, order);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const newBytes = await newDoc.save();
  return {
    bytes: new Uint8Array(newBytes),
    pageMetadata: buildPageMetadata(newDoc),
  };
}

/* ──────────────────────── Delete Page ──────────────────────── */

/**
 * Delete a page from the PDF.
 * @param bytes Original PDF bytes
 * @param pageNumber 1-based page number to delete
 */
export async function deletePage(
  bytes: Uint8Array,
  pageNumber: number,
): Promise<{ bytes: Uint8Array; pageMetadata: PageMeta[] }> {
  const doc = await loadPdf(bytes);
  const totalPages = doc.getPageCount();

  if (totalPages <= 1) {
    throw new Error('Cannot delete the only page in the document');
  }

  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new Error(`Invalid page number: ${pageNumber}`);
  }

  doc.removePage(pageNumber - 1);

  const newBytes = await doc.save();
  // Reload to get accurate page metadata after removal
  const reloaded = await loadPdf(new Uint8Array(newBytes));
  return {
    bytes: new Uint8Array(newBytes),
    pageMetadata: buildPageMetadata(reloaded),
  };
}

/* ──────────────────────── Insert Blank Page ──────────────────────── */

/**
 * Insert a blank page after the specified page.
 * @param bytes Original PDF bytes
 * @param afterPage 0 = insert at beginning, 1 = after first page, etc.
 * @param pageSize Page size preset or 'same-as-adjacent'
 * @param adjacentMeta Optional metadata of adjacent page (for 'same-as-adjacent')
 */
export async function insertBlankPage(
  bytes: Uint8Array,
  afterPage: number,
  pageSize: PageSize,
  adjacentMeta?: PageMeta,
): Promise<{ bytes: Uint8Array; pageMetadata: PageMeta[] }> {
  const doc = await loadPdf(bytes);
  const [w, h] = getPageSizePts(pageSize, adjacentMeta);

  const insertIndex = Math.max(0, Math.min(afterPage, doc.getPageCount()));
  doc.insertPage(insertIndex, [w, h]);

  const newBytes = await doc.save();
  return {
    bytes: new Uint8Array(newBytes),
    pageMetadata: buildPageMetadata(doc),
  };
}

/* ──────────────────────── Duplicate Page ──────────────────────── */

/**
 * Duplicate a page (insert copy right after original).
 * @param bytes Original PDF bytes
 * @param pageNumber 1-based page number to duplicate
 */
export async function duplicatePage(
  bytes: Uint8Array,
  pageNumber: number,
): Promise<{ bytes: Uint8Array; pageMetadata: PageMeta[] }> {
  const doc = await loadPdf(bytes);
  const totalPages = doc.getPageCount();

  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new Error(`Invalid page number: ${pageNumber}`);
  }

  const [copiedPage] = await doc.copyPages(doc, [pageNumber - 1]);
  doc.insertPage(pageNumber, copiedPage);

  const newBytes = await doc.save();
  return {
    bytes: new Uint8Array(newBytes),
    pageMetadata: buildPageMetadata(doc),
  };
}

/* ──────────────────────── Rotate Page ──────────────────────── */

/**
 * Rotate a single page.
 * @param bytes Original PDF bytes
 * @param pageNumber 1-based page number
 * @param degrees Rotation amount (90, 180, or 270 CW)
 */
export async function rotatePage(
  bytes: Uint8Array,
  pageNumber: number,
  degrees: 90 | 180 | 270,
): Promise<{ bytes: Uint8Array; pageMetadata: PageMeta[] }> {
  const doc = await loadPdf(bytes);
  const page = doc.getPage(pageNumber - 1);

  const currentRotation = page.getRotation().angle;
  const newRotation = ((currentRotation + degrees) % 360) as 0 | 90 | 180 | 270;
  page.setRotation({ type: 'degrees' as const, angle: newRotation } as never);

  const newBytes = await doc.save();
  return {
    bytes: new Uint8Array(newBytes),
    pageMetadata: buildPageMetadata(doc),
  };
}

/**
 * Rotate all pages by the same amount.
 */
export async function rotateAllPages(
  bytes: Uint8Array,
  degrees: 90 | 180 | 270,
): Promise<{ bytes: Uint8Array; pageMetadata: PageMeta[] }> {
  const doc = await loadPdf(bytes);
  const pages = doc.getPages();

  for (const page of pages) {
    const currentRotation = page.getRotation().angle;
    const newRotation = ((currentRotation + degrees) % 360) as
      | 0
      | 90
      | 180
      | 270;
    page.setRotation({ type: 'degrees' as const, angle: newRotation } as never);
  }

  const newBytes = await doc.save();
  return {
    bytes: new Uint8Array(newBytes),
    pageMetadata: buildPageMetadata(doc),
  };
}

/* ──────────────────────── Extract Pages ──────────────────────── */

/**
 * Extract specific pages into a new PDF document.
 * @param bytes Original PDF bytes
 * @param pageNumbers 1-based page numbers to extract
 */
export async function extractPages(
  bytes: Uint8Array,
  pageNumbers: number[],
): Promise<Uint8Array> {
  if (pageNumbers.length === 0) {
    throw new Error('No pages selected for extraction');
  }

  const srcDoc = await loadPdf(bytes);
  const totalPages = srcDoc.getPageCount();

  // Validate page numbers
  for (const p of pageNumbers) {
    if (p < 1 || p > totalPages) {
      throw new Error(`Invalid page number: ${p}`);
    }
  }

  const newDoc = await PDFDocument.create();
  const indices = pageNumbers.map((p) => p - 1);
  const copiedPages = await newDoc.copyPages(srcDoc, indices);

  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const newBytes = await newDoc.save();
  return new Uint8Array(newBytes);
}

/* ──────────────────────── Export Pages as Images ──────────────────────── */

/**
 * Render a single page to a canvas and export as image blob.
 * @param renderer The PageRenderer instance (from usePdfDocument)
 * @param pageNumber 1-based page number
 * @param dpi Target DPI (default 150)
 * @param format 'png' | 'jpeg'
 * @returns Blob of the rendered image
 */
export async function exportPageAsImage(
  renderer: {
    renderPage: (
      page: number,
      scale: number,
      canvas: HTMLCanvasElement,
    ) => Promise<void>;
  },
  pageNumber: number,
  pageMeta: PageMeta,
  dpi: number = 150,
  format: 'png' | 'jpeg' = 'png',
): Promise<Blob> {
  const scale = dpi / 72; // PDF points are 72 DPI
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(pageMeta.width * scale);
  canvas.height = Math.round(pageMeta.height * scale);

  await renderer.renderPage(pageNumber, scale, canvas);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to export page as image'));
      },
      format === 'jpeg' ? 'image/jpeg' : 'image/png',
      format === 'jpeg' ? 0.92 : undefined,
    );
  });
}

/* ──────────────────────── Download Helpers ──────────────────────── */

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadBytes(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/pdf',
  });
  downloadBlob(blob, fileName);
}
