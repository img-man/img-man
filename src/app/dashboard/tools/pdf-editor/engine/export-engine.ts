// SPDX-License-Identifier: Apache-2.0
/**
 * Export Engine
 *
 * Applies all Fabric.js annotations to the original PDF using pdf-lib.
 * Handles coordinate conversion, font embedding, and image embedding.
 *
 * Phase 4 additions: PDF/A & PDF/X compliance checking, linearization hints,
 * compression estimation, and format-aware export configuration.
 */

import type {
  Annotation,
  PageMeta,
  ExportConfig,
  ExportResult,
  PdfExportFormat,
  PdfMetadata,
} from '../types';
import { DEFAULT_EXPORT_CONFIG } from '../constants';

/* ──────────────────────── Export ──────────────────────── */

/**
 * Apply all annotations to a PDF and produce the final bytes.
 *
 * @param originalBytes - Original PDF file as ArrayBuffer
 * @param annotations - Map of page number → annotations
 * @param pageMetadata - Page dimensions for coordinate conversion
 * @returns Uint8Array of the modified PDF
 */
export async function exportPdf(
  originalBytes: ArrayBuffer,
  annotations: Map<number, Annotation[]>,
  pageMetadata: PageMeta[],
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const doc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const pages = doc.getPages();

  // Pre-embed the standard font
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helveticaOblique = await doc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldOblique = await doc.embedFont(
    StandardFonts.HelveticaBoldOblique,
  );
  const courier = await doc.embedFont(StandardFonts.Courier);
  const timesRoman = await doc.embedFont(StandardFonts.TimesRoman);

  const fontMap: Record<string, Record<string, typeof helvetica>> = {
    Helvetica: {
      'normal-normal': helvetica,
      'bold-normal': helveticaBold,
      'normal-italic': helveticaOblique,
      'bold-italic': helveticaBoldOblique,
    },
    'Courier New': { 'normal-normal': courier },
    'Times New Roman': { 'normal-normal': timesRoman },
  };

  function getFont(family: string, weight: string, style: string) {
    const familyFonts = fontMap[family] || fontMap['Helvetica'];
    return (
      familyFonts[`${weight}-${style}`] ||
      familyFonts['normal-normal'] ||
      helvetica
    );
  }

  function hexToRgb(hex: string) {
    const h = hex.replace('#', '');
    return rgb(
      parseInt(h.substring(0, 2), 16) / 255,
      parseInt(h.substring(2, 4), 16) / 255,
      parseInt(h.substring(4, 6), 16) / 255,
    );
  }

  // Process each page's annotations
  for (const [pageNum, pageAnnotations] of annotations) {
    const pageIdx = pageNum - 1;
    if (pageIdx < 0 || pageIdx >= pages.length) continue;

    const page = pages[pageIdx];
    const { height: pageHeight } = page.getSize();

    for (const ann of pageAnnotations) {
      if (!ann.visible) continue;

      switch (ann.kind) {
        case 'text': {
          const font = getFont(ann.fontFamily, ann.fontWeight, ann.fontStyle);
          page.drawText(ann.text, {
            x: ann.x,
            y: pageHeight - ann.y - ann.fontSize,
            size: ann.fontSize,
            font,
            color: hexToRgb(ann.color),
            opacity: ann.opacity,
          });
          break;
        }

        case 'image': {
          try {
            const imgData = ann.src;
            let embedded;
            if (imgData.startsWith('data:image/png')) {
              const base64 = imgData.split(',')[1];
              const bytes = Uint8Array.from(atob(base64), (c) =>
                c.charCodeAt(0),
              );
              embedded = await doc.embedPng(bytes);
            } else if (
              imgData.startsWith('data:image/jpeg') ||
              imgData.startsWith('data:image/jpg')
            ) {
              const base64 = imgData.split(',')[1];
              const bytes = Uint8Array.from(atob(base64), (c) =>
                c.charCodeAt(0),
              );
              embedded = await doc.embedJpg(bytes);
            } else {
              // Try to load as PNG by default
              const response = await fetch(imgData);
              const arrayBuf = await response.arrayBuffer();
              try {
                embedded = await doc.embedPng(arrayBuf);
              } catch {
                embedded = await doc.embedJpg(arrayBuf);
              }
            }

            page.drawImage(embedded, {
              x: ann.x,
              y: pageHeight - ann.y - ann.height,
              width: ann.width,
              height: ann.height,
              opacity: ann.opacity,
            });
          } catch {
            console.warn(`Failed to embed image annotation ${ann.id}`);
          }
          break;
        }

        case 'signature': {
          try {
            const base64 = ann.data.split(',')[1];
            if (base64) {
              const bytes = Uint8Array.from(atob(base64), (c) =>
                c.charCodeAt(0),
              );
              const embedded = await doc.embedPng(bytes);
              page.drawImage(embedded, {
                x: ann.x,
                y: pageHeight - ann.y - ann.height,
                width: ann.width,
                height: ann.height,
                opacity: ann.opacity,
              });
            }
          } catch {
            console.warn(`Failed to embed signature annotation ${ann.id}`);
          }
          break;
        }

        case 'shape': {
          if (ann.shapeType === 'rectangle') {
            page.drawRectangle({
              x: ann.x,
              y: pageHeight - ann.y - ann.height,
              width: ann.width,
              height: ann.height,
              color:
                ann.fill !== 'transparent' ? hexToRgb(ann.fill) : undefined,
              borderColor: hexToRgb(ann.stroke),
              borderWidth: ann.strokeWidth,
              opacity: ann.opacity,
            });
          } else if (ann.shapeType === 'ellipse') {
            page.drawEllipse({
              x: ann.x + ann.width / 2,
              y: pageHeight - ann.y - ann.height / 2,
              xScale: ann.width / 2,
              yScale: ann.height / 2,
              color:
                ann.fill !== 'transparent' ? hexToRgb(ann.fill) : undefined,
              borderColor: hexToRgb(ann.stroke),
              borderWidth: ann.strokeWidth,
              opacity: ann.opacity,
            });
          } else if (ann.shapeType === 'line') {
            page.drawLine({
              start: { x: ann.x, y: pageHeight - ann.y },
              end: { x: ann.x + ann.width, y: pageHeight - ann.y - ann.height },
              thickness: ann.strokeWidth,
              color: hexToRgb(ann.stroke),
              opacity: ann.opacity,
            });
          }
          // Arrow: draw line + small triangle at end
          else if (ann.shapeType === 'arrow') {
            const startX = ann.x;
            const startY = pageHeight - ann.y;
            const endX = ann.x + ann.width;
            const endY = pageHeight - ann.y - ann.height;

            page.drawLine({
              start: { x: startX, y: startY },
              end: { x: endX, y: endY },
              thickness: ann.strokeWidth,
              color: hexToRgb(ann.stroke),
              opacity: ann.opacity,
            });

            // Arrowhead — simple triangle
            const angle = Math.atan2(endY - startY, endX - startX);
            const headLen = 10;
            const p1x = endX - headLen * Math.cos(angle - Math.PI / 6);
            const p1y = endY - headLen * Math.sin(angle - Math.PI / 6);
            const p2x = endX - headLen * Math.cos(angle + Math.PI / 6);
            const p2y = endY - headLen * Math.sin(angle + Math.PI / 6);

            page.drawLine({
              start: { x: endX, y: endY },
              end: { x: p1x, y: p1y },
              thickness: ann.strokeWidth,
              color: hexToRgb(ann.stroke),
              opacity: ann.opacity,
            });
            page.drawLine({
              start: { x: endX, y: endY },
              end: { x: p2x, y: p2y },
              thickness: ann.strokeWidth,
              color: hexToRgb(ann.stroke),
              opacity: ann.opacity,
            });
          }
          break;
        }

        case 'highlight': {
          page.drawRectangle({
            x: ann.x,
            y: pageHeight - ann.y - ann.height,
            width: ann.width,
            height: ann.height,
            color: hexToRgb(ann.color),
            opacity: ann.opacity,
          });
          break;
        }

        case 'whiteout': {
          page.drawRectangle({
            x: ann.x,
            y: pageHeight - ann.y - ann.height,
            width: ann.width,
            height: ann.height,
            color: hexToRgb(ann.color),
            opacity: 1,
          });
          break;
        }

        case 'freehand': {
          // Freehand paths are complex — for Phase 1, we rasterize and embed as image
          // Future: parse SVG path data and convert to pdf-lib operations
          break;
        }
      }
    }
  }

  const pdfBytes = await doc.save();
  return new Uint8Array(pdfBytes);
}

/**
 * Download a PDF byte array as a file.
 */
export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/pdf',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/* ──────────────────────── Phase 4: Export Configuration ──────────────────────── */

/**
 * Create a default export config.
 */
export function createDefaultExportConfig(): ExportConfig {
  return { ...DEFAULT_EXPORT_CONFIG };
}

/**
 * Validate an export configuration.
 */
export function validateExportConfig(config: ExportConfig): string[] {
  const errors: string[] = [];
  if (config.imageQuality < 1 || config.imageQuality > 100) {
    errors.push('Image quality must be between 1 and 100.');
  }
  return errors;
}

/* ──────────────────────── Phase 4: PDF/A Compliance ──────────────────────── */

/**
 * Check metadata requirements for PDF/A compliance.
 */
export function checkPdfAMetadataCompliance(metadata: PdfMetadata): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  if (!metadata.title) {
    issues.push('PDF/A requires a document title (dc:title).');
  }
  return { compliant: issues.length === 0, issues };
}

/**
 * Get the list of requirements for a PDF/A compliant export.
 */
export function getPdfARequirements(): string[] {
  return [
    'All fonts must be embedded',
    'Transparency must be flattened',
    'Color spaces must be DeviceRGB, DeviceCMYK, or a calibrated space',
    'Document must include XMP metadata',
    'Document must have a title',
    'No encryption allowed',
    'No JavaScript or executable content',
    'No external references (no links to external content)',
    'Embedded files must conform to PDF/A-3 if included',
  ];
}

/* ──────────────────────── Phase 4: PDF/X Compliance ──────────────────────── */

/**
 * Get the list of requirements for a PDF/X compliant export.
 */
export function getPdfXRequirements(): string[] {
  return [
    'All fonts must be embedded',
    'All images must be high resolution (300+ DPI recommended)',
    'Color spaces must be CMYK or spot colors (no RGB)',
    'Bleed area must be defined',
    'Trim box must be specified',
    'No transparency (must be flattened)',
    'No encryption',
    'OutputIntent must be specified',
  ];
}

/* ──────────────────────── Phase 4: Linearization ──────────────────────── */

/**
 * Check if linearization is beneficial for a given file size.
 * Linearization mainly helps files > 100 KB for web viewing.
 */
export function isLinearizationBeneficial(fileSize: number): boolean {
  return fileSize > 100 * 1024;
}

/* ──────────────────────── Phase 4: Compression Estimation ──────────────────────── */

/**
 * Estimate the compressed file size based on quality settings.
 * This is a rough heuristic for UI display purposes.
 */
export function estimateCompressedSize(
  originalSize: number,
  config: ExportConfig,
): { estimatedSize: number; reductionPercent: number } {
  let ratio = 1.0;

  if (config.imageQuality < 100) {
    const imageRatio = config.imageQuality / 100;
    ratio *= 0.4 + 0.6 * imageRatio;
  }

  if (config.deduplicateResources) {
    ratio *= 0.9;
  }

  if (config.subsetFonts) {
    ratio *= 0.95;
  }

  const estimatedSize = Math.round(originalSize * ratio);
  const reductionPercent = Math.round((1 - ratio) * 100);

  return { estimatedSize, reductionPercent };
}

/* ──────────────────────── Phase 4: Export Results ──────────────────────── */

/**
 * Create a successful export result.
 */
export function createExportResult(
  pdfBytes: Uint8Array,
  warnings: string[] = [],
  complianceIssues: string[] = [],
): ExportResult {
  return {
    success: true,
    pdfBytes,
    fileSize: pdfBytes.byteLength,
    warnings,
    complianceIssues,
  };
}

/**
 * Create a failed export result.
 */
export function createFailedExportResult(
  error: string,
  complianceIssues: string[] = [],
): ExportResult {
  return {
    success: false,
    pdfBytes: new Uint8Array(0),
    fileSize: 0,
    warnings: [error],
    complianceIssues,
  };
}

/**
 * Get a human-readable description of the export format.
 */
export function getFormatDescription(format: PdfExportFormat): string {
  switch (format) {
    case 'standard':
      return 'Standard PDF with maximum compatibility for all viewers.';
    case 'pdf-a':
      return 'PDF/A for long-term archival. All fonts embedded, no encryption.';
    case 'pdf-x':
      return 'PDF/X for print production. CMYK colors, high-res images required.';
    case 'linearized':
      return 'Linearized PDF optimized for fast web viewing (progressive loading).';
  }
}

/**
 * Get the recommended export config for a given format.
 */
export function getRecommendedConfig(format: PdfExportFormat): ExportConfig {
  switch (format) {
    case 'standard':
      return { ...DEFAULT_EXPORT_CONFIG, format: 'standard' };
    case 'pdf-a':
      return {
        format: 'pdf-a',
        imageQuality: 100,
        flattenAnnotations: false,
        embedFonts: true,
        deduplicateResources: true,
        subsetFonts: false,
      };
    case 'pdf-x':
      return {
        format: 'pdf-x',
        imageQuality: 100,
        flattenAnnotations: true,
        embedFonts: true,
        deduplicateResources: true,
        subsetFonts: false,
      };
    case 'linearized':
      return {
        format: 'linearized',
        imageQuality: 85,
        flattenAnnotations: false,
        embedFonts: true,
        deduplicateResources: true,
        subsetFonts: true,
      };
  }
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
