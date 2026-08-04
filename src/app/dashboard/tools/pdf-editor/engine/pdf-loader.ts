// SPDX-License-Identifier: Apache-2.0
/**
 * PDF Loader Engine
 *
 * Handles loading PDF documents using PDF.js with Web Worker support.
 * Provides utilities for document initialization and page access.
 */

import type { PageMeta } from '../types';

/* ──────────────────────── PDF.js Configuration ──────────────────────── */

let pdfjsLib: typeof import('pdfjs-dist') | null = null;

/**
 * Lazily load and configure PDF.js.
 * Sets up the Web Worker for off-main-thread rendering.
 */
export async function getPdfjs() {
  if (pdfjsLib) return pdfjsLib;

  pdfjsLib = await import('pdfjs-dist');

  // Configure the worker — use the bundled worker from pdfjs-dist
  // In production, this will be loaded as a separate chunk
  if (typeof window !== 'undefined') {
    const workerSrc = await import('pdfjs-dist/build/pdf.worker.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc.default ?? workerSrc;
  }

  return pdfjsLib;
}

/* ──────────────────────── Document Loading ──────────────────────── */

export interface LoadedDocument {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any; // PDFDocumentProxy
  totalPages: number;
  pageMetadata: PageMeta[];
}

/**
 * Load a PDF from an ArrayBuffer.
 * Returns the document proxy and extracted page metadata.
 */
export async function loadPdfFromBuffer(
  buffer: ArrayBuffer,
): Promise<LoadedDocument> {
  const pdfjs = await getPdfjs();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
    enableXfa: true,
  });

  const document = await loadingTask.promise;
  const totalPages = document.numPages;

  // Extract page metadata for all pages
  const pageMetadata: PageMeta[] = [];
  for (let i = 1; i <= totalPages; i++) {
    const page = await document.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });

    pageMetadata.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate || 0,
    });
  }

  return { document, totalPages, pageMetadata };
}

/**
 * Load a PDF from a File object.
 */
export async function loadPdfFromFile(file: File): Promise<LoadedDocument> {
  const buffer = await file.arrayBuffer();
  return loadPdfFromBuffer(buffer);
}

/**
 * Load a PDF from a URL.
 */
export async function loadPdfFromUrl(url: string): Promise<LoadedDocument> {
  const pdfjs = await getPdfjs();

  const loadingTask = pdfjs.getDocument({
    url,
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
    enableXfa: true,
  });

  const document = await loadingTask.promise;
  const totalPages = document.numPages;

  const pageMetadata: PageMeta[] = [];
  for (let i = 1; i <= totalPages; i++) {
    const page = await document.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    pageMetadata.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      rotation: page.rotate || 0,
    });
  }

  return { document, totalPages, pageMetadata };
}

/* ──────────────────────── Page Access ──────────────────────── */

/**
 * Get a specific page from a loaded document.
 * Pages are 1-indexed.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getPage(document: any, pageNumber: number) {
  if (pageNumber < 1 || pageNumber > document.numPages) {
    throw new RangeError(
      `Page ${pageNumber} out of range (1–${document.numPages})`,
    );
  }
  return document.getPage(pageNumber);
}

/**
 * Get the viewport for a page at a given scale.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPageViewport(page: any, scale: number, rotation = 0) {
  return page.getViewport({ scale, rotation });
}
