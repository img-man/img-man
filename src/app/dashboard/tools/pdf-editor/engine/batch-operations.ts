// SPDX-License-Identifier: Apache-2.0
/**
 * Batch Operations — Phase 4, Week 14
 *
 * Defines individual batch operation implementations.
 * Each operation takes a PDF file (Uint8Array) plus config and returns
 * processed bytes or multiple results.
 *
 * These are designed to run in a Web Worker or server-side context.
 */

import type {
  BatchOperationType,
  HeaderFooterConfig,
  PageNumberConfig,
} from '../types';

/* ──────────────────────── Operation Config Types ──────────────────────── */

export interface SplitConfig {
  /** Page ranges to split into, e.g. ['1-3', '4-6', '7'] */
  ranges: string[];
}

export interface CompressConfig {
  /** Image quality (1-100) */
  imageQuality: number;
  /** Remove duplicate objects */
  deduplicateObjects: boolean;
}

export interface WatermarkConfig {
  text: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  position:
    | 'center'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
}

export interface PasswordProtectConfig {
  userPassword: string;
  ownerPassword: string;
  /** Permission flags integer */
  permissionFlags: number;
}

export interface ConvertToImagesConfig {
  format: 'png' | 'jpeg';
  dpi: number;
  quality: number; // for JPEG
}

export interface RotateConfig {
  degrees: 0 | 90 | 180 | 270;
  /** Pages to rotate: 'all' or '1,3,5' or '2-5' */
  pageRange: string;
}

export interface PageNumbersConfig {
  position: 'header' | 'footer';
  alignment: 'left' | 'center' | 'right';
  format: 'decimal' | 'roman' | 'page-of';
  startNumber: number;
  fontSize: number;
  fontFamily: string;
  color: string;
}

export interface HeaderFooterBatchConfig {
  configs: HeaderFooterConfig[];
  pageNumberConfig?: PageNumberConfig;
}

export type BatchOperationConfig =
  | { type: 'merge' }
  | { type: 'split'; config: SplitConfig }
  | { type: 'compress'; config: CompressConfig }
  | { type: 'watermark'; config: WatermarkConfig }
  | { type: 'password-protect'; config: PasswordProtectConfig }
  | { type: 'convert-to-images'; config: ConvertToImagesConfig }
  | { type: 'flatten' }
  | { type: 'rotate'; config: RotateConfig }
  | { type: 'add-page-numbers'; config: PageNumbersConfig }
  | { type: 'add-header-footer'; config: HeaderFooterBatchConfig };

/* ──────────────────────── Operation Results ──────────────────────── */

export interface BatchOperationResult {
  success: boolean;
  /** Single output file (most operations) */
  outputBytes?: Uint8Array;
  /** Multiple output files (split, convert-to-images) */
  multipleOutputs?: { name: string; bytes: Uint8Array }[];
  /** Error message if failed */
  error?: string;
  /** Output file size */
  outputSize?: number;
}

/* ──────────────────────── Operation Descriptions ──────────────────────── */

/**
 * Get a human-readable description for a batch operation.
 */
export function getOperationDescription(operation: BatchOperationType): string {
  switch (operation) {
    case 'merge':
      return 'Combine multiple PDF files into a single document.';
    case 'split':
      return 'Split each PDF into smaller documents by page range.';
    case 'compress':
      return 'Reduce file size by optimizing images and removing duplicates.';
    case 'watermark':
      return 'Add a text watermark to all pages of each PDF.';
    case 'password-protect':
      return 'Apply password protection and encryption to each PDF.';
    case 'convert-to-images':
      return 'Convert each page of each PDF to an image (PNG/JPEG).';
    case 'flatten':
      return 'Flatten all form fields and annotations into the page content.';
    case 'rotate':
      return 'Rotate pages by the specified angle.';
    case 'add-page-numbers':
      return 'Add page numbers as header or footer text.';
    case 'add-header-footer':
      return 'Add custom headers and footers to each PDF.';
  }
}

/**
 * Determine if an operation produces multiple output files per input.
 */
export function isMultiOutputOperation(operation: BatchOperationType): boolean {
  return operation === 'split' || operation === 'convert-to-images';
}

/**
 * Determine if an operation combines multiple inputs into one output.
 */
export function isMergeOperation(operation: BatchOperationType): boolean {
  return operation === 'merge';
}

/**
 * Get the default config for a batch operation.
 */
export function getDefaultBatchConfig(
  operation: BatchOperationType,
): Record<string, unknown> {
  switch (operation) {
    case 'merge':
      return {};
    case 'split':
      return { ranges: [] };
    case 'compress':
      return { imageQuality: 75, deduplicateObjects: true };
    case 'watermark':
      return {
        text: 'DRAFT',
        fontSize: 48,
        color: '#888888',
        opacity: 0.3,
        rotation: -45,
        position: 'center',
      };
    case 'password-protect':
      return { userPassword: '', ownerPassword: '', permissionFlags: -4 };
    case 'convert-to-images':
      return { format: 'png', dpi: 150, quality: 85 };
    case 'flatten':
      return {};
    case 'rotate':
      return { degrees: 90, pageRange: 'all' };
    case 'add-page-numbers':
      return {
        position: 'footer',
        alignment: 'center',
        format: 'decimal',
        startNumber: 1,
        fontSize: 10,
        fontFamily: 'Helvetica',
        color: '#000000',
      };
    case 'add-header-footer':
      return { configs: [], pageNumberConfig: undefined };
  }
}

/**
 * Validate operation-specific config.
 */
export function validateBatchConfig(
  operation: BatchOperationType,
  config: Record<string, unknown>,
): string[] {
  const errors: string[] = [];

  switch (operation) {
    case 'password-protect': {
      const pwd = config.userPassword as string;
      if (!pwd && !config.ownerPassword) {
        errors.push('At least one password (user or owner) must be set.');
      }
      break;
    }
    case 'watermark': {
      if (!config.text) errors.push('Watermark text is required.');
      break;
    }
    case 'rotate': {
      const degrees = config.degrees as number;
      if (![0, 90, 180, 270].includes(degrees)) {
        errors.push('Rotation must be 0, 90, 180, or 270 degrees.');
      }
      break;
    }
    case 'compress': {
      const q = config.imageQuality as number;
      if (q < 1 || q > 100) errors.push('Image quality must be 1-100.');
      break;
    }
    case 'convert-to-images': {
      const dpi = config.dpi as number;
      if (dpi < 72 || dpi > 600) errors.push('DPI must be 72-600.');
      break;
    }
    default:
      break;
  }

  return errors;
}

/**
 * Get the estimated output file name for a batch operation.
 */
export function getOutputFileName(
  inputName: string,
  operation: BatchOperationType,
  index?: number,
): string {
  const base = inputName.replace(/\.pdf$/i, '');
  switch (operation) {
    case 'merge':
      return 'merged.pdf';
    case 'split':
      return `${base}_part${index ?? 1}.pdf`;
    case 'compress':
      return `${base}_compressed.pdf`;
    case 'watermark':
      return `${base}_watermarked.pdf`;
    case 'password-protect':
      return `${base}_protected.pdf`;
    case 'convert-to-images':
      return `${base}_page${index ?? 1}.png`;
    case 'flatten':
      return `${base}_flattened.pdf`;
    case 'rotate':
      return `${base}_rotated.pdf`;
    case 'add-page-numbers':
      return `${base}_numbered.pdf`;
    case 'add-header-footer':
      return `${base}_headered.pdf`;
  }
}
