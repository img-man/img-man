// SPDX-License-Identifier: Apache-2.0
/**
 * Metadata Engine — Phase 4, Week 15
 *
 * Reads and writes PDF document metadata (Title, Author, Subject, etc.)
 * via pdf-lib. Also handles Bates numbering and page label generation.
 */

import type {
  PdfMetadata,
  BatesConfig,
  PageLabelRange,
  PageLabelStyle,
} from '../types';
import { DEFAULT_BATES_CONFIG } from '../constants';

/* ──────────────────────── Metadata CRUD ──────────────────────── */

/**
 * Create a blank metadata object.
 */
export function createEmptyMetadata(): PdfMetadata {
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

/**
 * Merge partial metadata updates into an existing metadata object.
 */
export function updateMetadata(
  current: PdfMetadata,
  updates: Partial<PdfMetadata>,
): PdfMetadata {
  return {
    ...current,
    ...updates,
    custom: { ...current.custom, ...updates.custom },
  };
}

/**
 * Check if metadata has any non-empty fields.
 */
export function hasMetadata(metadata: PdfMetadata): boolean {
  return !!(
    metadata.title ||
    metadata.author ||
    metadata.subject ||
    metadata.keywords ||
    metadata.creator ||
    metadata.producer ||
    metadata.creationDate ||
    metadata.modificationDate ||
    Object.keys(metadata.custom).length > 0
  );
}

/**
 * Get a summary of metadata field count.
 */
export function getMetadataFieldCount(metadata: PdfMetadata): number {
  let count = 0;
  if (metadata.title) count++;
  if (metadata.author) count++;
  if (metadata.subject) count++;
  if (metadata.keywords) count++;
  if (metadata.creator) count++;
  if (metadata.producer) count++;
  if (metadata.creationDate) count++;
  if (metadata.modificationDate) count++;
  count += Object.keys(metadata.custom).length;
  return count;
}

/**
 * Parse keywords string into an array.
 */
export function parseKeywords(keywords: string): string[] {
  if (!keywords) return [];
  return keywords
    .split(/[,;]/)
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Join keyword array into a string.
 */
export function joinKeywords(keywords: string[]): string {
  return keywords.filter(Boolean).join(', ');
}

/* ──────────────────────── Bates Numbering ──────────────────────── */

/**
 * Format a single Bates number.
 */
export function formatBatesNumber(
  pageIndex: number,
  config: BatesConfig,
): string {
  const number = config.startNumber + pageIndex;
  const numStr = String(number).padStart(config.numberOfDigits, '0');
  return `${config.prefix}${numStr}${config.suffix}`;
}

/**
 * Generate Bates numbers for all pages in a range.
 */
export function generateBatesNumbers(
  totalPages: number,
  config: BatesConfig,
): Map<number, string> {
  const result = new Map<number, string>();
  const range = parseBatesPageRange(config.pageRange, totalPages);

  let idx = 0;
  for (const page of range) {
    result.set(page, formatBatesNumber(idx, config));
    idx++;
  }

  return result;
}

/**
 * Parse the page range for Bates numbering.
 */
function parseBatesPageRange(range: string, totalPages: number): number[] {
  if (!range || range.trim().toLowerCase() === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Set<number> = new Set();
  const parts = range.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const num = parseInt(part, 10);
      if (num >= 1 && num <= totalPages) pages.add(num);
    }
  }

  return [...pages].sort((a, b) => a - b);
}

/**
 * Validate a Bates configuration.
 */
export function validateBatesConfig(config: BatesConfig): string[] {
  const errors: string[] = [];

  if (config.numberOfDigits < 1 || config.numberOfDigits > 10) {
    errors.push('Number of digits must be between 1 and 10.');
  }
  if (config.startNumber < 0) {
    errors.push('Start number must be non-negative.');
  }
  if (config.fontSize < 4 || config.fontSize > 72) {
    errors.push('Font size must be between 4 and 72.');
  }

  return errors;
}

/**
 * Create a default Bates config.
 */
export function createDefaultBatesConfig(): BatesConfig {
  return { ...DEFAULT_BATES_CONFIG };
}

/* ──────────────────────── Page Labels ──────────────────────── */

/**
 * Convert a number to label text according to the style.
 */
export function numberToLabel(num: number, style: PageLabelStyle): string {
  switch (style) {
    case 'decimal':
      return String(num);
    case 'roman-upper':
      return toRomanUpper(num);
    case 'roman-lower':
      return toRomanLower(num);
    case 'alpha-upper':
      return toAlpha(num, 'A');
    case 'alpha-lower':
      return toAlpha(num, 'a');
  }
}

function toRomanUpper(num: number): string {
  if (num <= 0 || num > 3999) return String(num);
  const map: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let result = '';
  let rem = num;
  for (const [value, numeral] of map) {
    while (rem >= value) {
      result += numeral;
      rem -= value;
    }
  }
  return result;
}

function toRomanLower(num: number): string {
  return toRomanUpper(num).toLowerCase();
}

function toAlpha(num: number, base: string): string {
  // A=1, B=2, ..., Z=26, AA=27, AB=28, etc.
  let result = '';
  let n = num;
  while (n > 0) {
    n--;
    result = String.fromCharCode(base.charCodeAt(0) + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

/**
 * Generate page labels for all pages given a set of label ranges.
 */
export function generatePageLabels(
  totalPages: number,
  ranges: PageLabelRange[],
): Map<number, string> {
  const labels = new Map<number, string>();

  // Sort ranges by start page
  const sorted = [...ranges].sort((a, b) => a.startPage - b.startPage);

  for (let page = 1; page <= totalPages; page++) {
    // Find the applicable range (last range whose startPage <= page)
    let activeRange: PageLabelRange | null = null;
    for (const range of sorted) {
      if (range.startPage <= page) activeRange = range;
      else break;
    }

    if (activeRange) {
      const offset = page - activeRange.startPage;
      const labelNum = activeRange.startLabelNumber + offset;
      const labelText = numberToLabel(labelNum, activeRange.style);
      labels.set(page, `${activeRange.prefix}${labelText}`);
    } else {
      labels.set(page, String(page));
    }
  }

  return labels;
}

/**
 * Create a default page label range.
 */
export function createDefaultPageLabelRange(startPage = 1): PageLabelRange {
  return {
    startPage,
    style: 'decimal',
    prefix: '',
    startLabelNumber: 1,
  };
}

/**
 * Validate page label ranges.
 */
export function validatePageLabelRanges(
  ranges: PageLabelRange[],
  totalPages: number,
): string[] {
  const errors: string[] = [];

  for (const range of ranges) {
    if (range.startPage < 1 || range.startPage > totalPages) {
      errors.push(
        `Start page ${range.startPage} is out of range (1-${totalPages}).`,
      );
    }
    if (range.startLabelNumber < 1) {
      errors.push('Start label number must be at least 1.');
    }
  }

  // Check for duplicate start pages
  const startPages = ranges.map((r) => r.startPage);
  const duplicates = startPages.filter((p, i) => startPages.indexOf(p) !== i);
  if (duplicates.length > 0) {
    errors.push(
      `Duplicate start pages: ${[...new Set(duplicates)].join(', ')}`,
    );
  }

  return errors;
}
