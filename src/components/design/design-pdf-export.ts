// SPDX-License-Identifier: Apache-2.0
/**
 * Design Studio — Multi-Page PDF Export
 *
 * Exports all design pages to a single multi-page PDF using pdf-lib.
 *
 * Strategy:
 * 1. For each page, render the SVG canvas to a PNG image (via OffscreenCanvas / HTMLCanvasElement).
 * 2. Embed each PNG into a pdf-lib PDFDocument as a full-page image.
 * 3. Return the PDF bytes for download.
 *
 * This avoids complex SVG-to-PDF vector conversion while preserving visual fidelity.
 * Future enhancement: vector export via direct pdf-lib drawing commands.
 */

import type { DesignPage } from './editor-types';

/* ──────────────────────── Types ──────────────────────── */

export interface PdfExportOptions {
  /** DPI scale factor for rasterization (default: 2 for 144 DPI) */
  scale: number;
  /** JPEG quality 0-1 if using JPEG embedding (default: 0.92) */
  quality: number;
  /** Image format for embedding: 'png' for lossless, 'jpeg' for smaller files */
  format: 'png' | 'jpeg';
  /** Optional PDF metadata */
  title?: string;
  author?: string;
  subject?: string;
  /** Callback for progress updates */
  onProgress?: (current: number, total: number) => void;
}

export interface PdfExportResult {
  /** The PDF file as Uint8Array bytes */
  bytes: Uint8Array;
  /** Total pages exported */
  pageCount: number;
  /** File size in bytes */
  fileSize: number;
}

/* ──────────────────────── Default Options ──────────────────────── */

export const DEFAULT_PDF_EXPORT_OPTIONS: PdfExportOptions = {
  scale: 2,
  quality: 0.92,
  format: 'png',
};

/* ──────────────────────── SVG to Image ──────────────────────── */

/**
 * Render an SVG string to a PNG/JPEG data URL using an HTMLCanvasElement.
 * Works in browser environments only.
 *
 * @param svgString - The complete SVG markup
 * @param width - Target width in CSS pixels
 * @param height - Target height in CSS pixels
 * @param scale - DPI scale factor
 * @param format - Output format
 * @param quality - JPEG quality (ignored for PNG)
 */
export async function svgToImageBytes(
  svgString: string,
  width: number,
  height: number,
  scale: number = 2,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 0.92,
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Failed to get 2D context'));
      return;
    }

    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (resultBlob) => {
          if (!resultBlob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          resultBlob
            .arrayBuffer()
            .then((buffer) => resolve(new Uint8Array(buffer)), reject);
        },
        format === 'jpeg' ? 'image/jpeg' : 'image/png',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = url;
  });
}

/* ──────────────────────── Multi-Page Export ──────────────────────── */

/**
 * Export multiple design pages to a single multi-page PDF.
 *
 * @param pages - Array of DesignPage objects
 * @param renderPageSvg - Function that renders a page index to an SVG string
 * @param options - Export configuration (optional)
 * @returns PdfExportResult with PDF bytes and metadata
 */
export async function exportDesignToPdf(
  pages: DesignPage[],
  renderPageSvg: (page: DesignPage, index: number) => string,
  options: Partial<PdfExportOptions> = {},
): Promise<PdfExportResult> {
  const opts: PdfExportOptions = { ...DEFAULT_PDF_EXPORT_OPTIONS, ...options };
  const { PDFDocument } = await import('pdf-lib');

  const doc = await PDFDocument.create();

  // Set metadata
  if (opts.title) doc.setTitle(opts.title);
  if (opts.author) doc.setAuthor(opts.author);
  if (opts.subject) doc.setSubject(opts.subject);
  doc.setCreator('img-man Design Studio');
  doc.setProducer('pdf-lib');

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const svgString = renderPageSvg(page, i);

    // Render SVG to image bytes
    const imageBytes = await svgToImageBytes(
      svgString,
      page.width,
      page.height,
      opts.scale,
      opts.format,
      opts.quality,
    );

    // Embed image
    const embedFn =
      opts.format === 'jpeg' ? doc.embedJpg.bind(doc) : doc.embedPng.bind(doc);
    const image = await embedFn(imageBytes);

    // Add page with exact dimensions (in PDF points = CSS pixels at 72 DPI)
    const pdfPage = doc.addPage([page.width, page.height]);
    pdfPage.drawImage(image, {
      x: 0,
      y: 0,
      width: page.width,
      height: page.height,
    });

    opts.onProgress?.(i + 1, pages.length);
  }

  const bytes = await doc.save();

  return {
    bytes,
    pageCount: pages.length,
    fileSize: bytes.byteLength,
  };
}

/* ──────────────────────── Download Helper ──────────────────────── */

/**
 * Trigger a browser download for PDF bytes.
 *
 * @param bytes - PDF file bytes
 * @param fileName - Download file name (default: 'design.pdf')
 */
export function downloadDesignPdf(
  bytes: Uint8Array,
  fileName: string = 'design.pdf',
): void {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ──────────────────────── Single-Page Export ──────────────────────── */

/**
 * Export a single design page to PDF.
 * Convenience wrapper around exportDesignToPdf for single-page designs.
 */
export async function exportSinglePageToPdf(
  page: DesignPage,
  svgString: string,
  options: Partial<PdfExportOptions> = {},
): Promise<PdfExportResult> {
  return exportDesignToPdf([page], () => svgString, options);
}
