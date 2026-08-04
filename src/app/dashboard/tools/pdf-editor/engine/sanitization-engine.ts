// SPDX-License-Identifier: Apache-2.0
/**
 * Document Sanitization Engine — Phase 4, Week 13
 *
 * Strips sensitive metadata, hidden layers, JavaScript, attachments,
 * annotations, and transparency from PDF documents.
 *
 * Works with pdf-lib on the client side for metadata/annotation operations.
 * Some operations (hidden layers, JS) require server-side processing.
 */

import type {
  SanitizationOptions,
  SanitizationResult,
  PdfMetadata,
} from '../types';
import { DEFAULT_SANITIZATION_OPTIONS } from '../constants';

/* ──────────────────────── Metadata Stripping ──────────────────────── */

/**
 * List of standard PDF metadata keys that can be stripped.
 */
export const METADATA_KEYS = [
  'Title',
  'Author',
  'Subject',
  'Keywords',
  'Creator',
  'Producer',
  'CreationDate',
  'ModDate',
] as const;

/**
 * List of potentially sensitive XMP metadata namespaces.
 */
export const SENSITIVE_XMP_NAMESPACES = [
  'http://ns.adobe.com/xap/1.0/', // xmp:
  'http://purl.org/dc/elements/1.1/', // dc:
  'http://ns.adobe.com/pdf/1.3/', // pdf:
  'http://ns.adobe.com/xap/1.0/mm/', // xmpMM:
  'http://ns.adobe.com/pdfx/1.3/', // pdfx:
] as const;

/**
 * Build a summary of what metadata exists in a document.
 */
export function inspectMetadata(metadata: PdfMetadata): {
  hasTitle: boolean;
  hasAuthor: boolean;
  hasSubject: boolean;
  hasKeywords: boolean;
  hasCreator: boolean;
  hasProducer: boolean;
  hasCreationDate: boolean;
  hasModificationDate: boolean;
  customCount: number;
  totalFields: number;
} {
  let totalFields = 0;
  const hasTitle = !!metadata.title;
  if (hasTitle) totalFields++;
  const hasAuthor = !!metadata.author;
  if (hasAuthor) totalFields++;
  const hasSubject = !!metadata.subject;
  if (hasSubject) totalFields++;
  const hasKeywords = !!metadata.keywords;
  if (hasKeywords) totalFields++;
  const hasCreator = !!metadata.creator;
  if (hasCreator) totalFields++;
  const hasProducer = !!metadata.producer;
  if (hasProducer) totalFields++;
  const hasCreationDate = !!metadata.creationDate;
  if (hasCreationDate) totalFields++;
  const hasModificationDate = !!metadata.modificationDate;
  if (hasModificationDate) totalFields++;
  const customCount = Object.keys(metadata.custom).length;
  totalFields += customCount;

  return {
    hasTitle,
    hasAuthor,
    hasSubject,
    hasKeywords,
    hasCreator,
    hasProducer,
    hasCreationDate,
    hasModificationDate,
    customCount,
    totalFields,
  };
}

/**
 * Create a clean metadata object with all fields blanked.
 */
export function createBlankMetadata(): PdfMetadata {
  return {
    title: '',
    author: '',
    subject: '',
    keywords: '',
    creator: '',
    producer: '',
    creationDate: undefined,
    modificationDate: undefined,
    custom: {},
  };
}

/* ──────────────────────── Sanitization Planning ──────────────────────── */

/**
 * Describe what each sanitization option will do, for user review.
 */
export function describeSanitizationActions(
  options: SanitizationOptions,
): string[] {
  const actions: string[] = [];

  if (options.stripMetadata) {
    actions.push(
      'Remove all document metadata (author, title, dates, keywords, custom properties)',
    );
  }
  if (options.removeHiddenLayers) {
    actions.push('Remove hidden layers and optional content groups (OCGs)');
  }
  if (options.removeJavaScript) {
    actions.push('Remove all embedded JavaScript actions');
  }
  if (options.removeAttachments) {
    actions.push('Remove all embedded file attachments');
  }
  if (options.removeAnnotations) {
    actions.push('Remove all annotations (comments, highlights, stamps, etc.)');
  }
  if (options.flattenTransparency) {
    actions.push(
      'Flatten transparency (merge transparent layers into opaque content)',
    );
  }

  return actions;
}

/**
 * Estimate the number of operations a sanitization pass will perform.
 */
export function estimateSanitizationWork(
  options: SanitizationOptions,
  metadata: PdfMetadata,
  annotationCount: number,
): number {
  let ops = 0;
  if (options.stripMetadata) ops += inspectMetadata(metadata).totalFields;
  if (options.removeHiddenLayers) ops += 1; // single pass
  if (options.removeJavaScript) ops += 1;
  if (options.removeAttachments) ops += 1;
  if (options.removeAnnotations) ops += annotationCount;
  if (options.flattenTransparency) ops += 1;
  return ops;
}

/* ──────────────────────── Client-Side Sanitization Preview ──────────────────────── */

/**
 * Preview what would be removed without actually modifying the document.
 * Returns a list of items that would be stripped.
 */
export function previewSanitization(
  options: SanitizationOptions,
  metadata: PdfMetadata,
  annotationCount: number,
  hasJavaScript: boolean,
  attachmentCount: number,
  hiddenLayerCount: number,
): { category: string; count: number; description: string }[] {
  const preview: { category: string; count: number; description: string }[] =
    [];

  if (options.stripMetadata) {
    const info = inspectMetadata(metadata);
    if (info.totalFields > 0) {
      preview.push({
        category: 'Metadata',
        count: info.totalFields,
        description: `${info.totalFields} metadata field(s) will be removed`,
      });
    }
  }

  if (options.removeHiddenLayers && hiddenLayerCount > 0) {
    preview.push({
      category: 'Hidden Layers',
      count: hiddenLayerCount,
      description: `${hiddenLayerCount} hidden layer(s) will be removed`,
    });
  }

  if (options.removeJavaScript && hasJavaScript) {
    preview.push({
      category: 'JavaScript',
      count: 1,
      description: 'All embedded JavaScript will be removed',
    });
  }

  if (options.removeAttachments && attachmentCount > 0) {
    preview.push({
      category: 'Attachments',
      count: attachmentCount,
      description: `${attachmentCount} embedded attachment(s) will be removed`,
    });
  }

  if (options.removeAnnotations && annotationCount > 0) {
    preview.push({
      category: 'Annotations',
      count: annotationCount,
      description: `${annotationCount} annotation(s) will be removed`,
    });
  }

  if (options.flattenTransparency) {
    preview.push({
      category: 'Transparency',
      count: 1,
      description: 'Transparent layers will be flattened',
    });
  }

  return preview;
}

/**
 * Create a default sanitization options object.
 */
export function createDefaultSanitizationOptions(): SanitizationOptions {
  return { ...DEFAULT_SANITIZATION_OPTIONS };
}

/**
 * Build a SanitizationResult from operation outcomes.
 */
export function buildSanitizationResult(
  removedItems: string[],
  originalSize: number,
  sanitizedSize: number,
): SanitizationResult {
  return {
    success: true,
    removedItems,
    originalSize,
    sanitizedSize,
  };
}

/**
 * Format a sanitization result for display.
 */
export function formatSanitizationSummary(result: SanitizationResult): string {
  const saved = result.originalSize - result.sanitizedSize;
  const pct =
    result.originalSize > 0
      ? Math.round((saved / result.originalSize) * 100)
      : 0;

  const lines = [
    `Sanitization ${result.success ? 'completed' : 'failed'}`,
    `Removed ${result.removedItems.length} item(s)`,
    `Size: ${formatBytes(result.originalSize)} → ${formatBytes(result.sanitizedSize)} (${pct}% reduction)`,
  ];

  return lines.join('\n');
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
