// SPDX-License-Identifier: Apache-2.0
/**
 * Header & Footer Engine — Phase 3, Week 10
 *
 * Applies headers, footers, and page numbers to PDF pages via pdf-lib.
 * Supports variable substitution ({page}, {pages}, {date}, {filename}).
 * Supports odd/even page differentiation and custom page ranges.
 */

import type { HeaderFooterConfig, PageNumberConfig, PageMeta } from '../types';

/* ──────────────────────── Variable Substitution ──────────────────────── */

/**
 * Replace template variables with actual values.
 */
export function substituteVariables(
  template: string,
  pageNumber: number,
  totalPages: number,
  fileName: string,
): string {
  const now = new Date();
  const dateStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}/${now.getFullYear()}`;

  return template
    .replace(/\{page\}/g, String(pageNumber))
    .replace(/\{pages\}/g, String(totalPages))
    .replace(/\{date\}/g, dateStr)
    .replace(/\{filename\}/g, fileName);
}

/* ──────────────────────── Page Number Formatting ──────────────────────── */

/**
 * Convert an integer to lowercase Roman numerals.
 */
export function toRoman(num: number): string {
  if (num <= 0 || num > 3999) return String(num);

  const romanMap: [number, string][] = [
    [1000, 'm'],
    [900, 'cm'],
    [500, 'd'],
    [400, 'cd'],
    [100, 'c'],
    [90, 'xc'],
    [50, 'l'],
    [40, 'xl'],
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];

  let result = '';
  let remaining = num;
  for (const [value, numeral] of romanMap) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

/**
 * Format a page number according to the specified format.
 */
export function formatPageNumber(
  format: PageNumberConfig['format'],
  pageNumber: number,
  totalPages: number,
  startNumber: number,
): string {
  const displayNum = pageNumber - 1 + startNumber;

  switch (format) {
    case 'decimal':
      return String(displayNum);
    case 'decimal-total':
      return `${displayNum}/${totalPages - 1 + startNumber}`;
    case 'page-of':
      return `Page ${displayNum} of ${totalPages - 1 + startNumber}`;
    case 'roman':
      return toRoman(displayNum);
    default:
      return String(displayNum);
  }
}

/* ──────────────────────── Page Range Parsing ──────────────────────── */

/**
 * Parse a page range string like "1-5,8,10-12" or "all".
 * Returns a Set of 1-based page numbers.
 */
export function parsePageRange(range: string, totalPages: number): Set<number> {
  if (!range || range.trim().toLowerCase() === 'all') {
    return new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
  }

  const result = new Set<number>();
  const parts = range.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
      for (let i = start; i <= end; i++) {
        result.add(i);
      }
    } else {
      const num = parseInt(part, 10);
      if (num >= 1 && num <= totalPages) {
        result.add(num);
      }
    }
  }

  return result;
}

/* ──────────────────────── Compute Text for Each Page ──────────────────────── */

export interface HeaderFooterEntry {
  text: string;
  position: 'header' | 'footer';
  alignment: 'left' | 'center' | 'right';
  fontFamily: string;
  fontSize: number;
  color: string;
  margin: number;
}

/**
 * Compute the header/footer text entries for a given page.
 * Evaluates all configs and page number config, filtering by page range and odd/even.
 */
export function computePageEntries(
  pageNumber: number,
  totalPages: number,
  fileName: string,
  configs: HeaderFooterConfig[],
  pageNumberConfig?: PageNumberConfig,
): HeaderFooterEntry[] {
  const entries: HeaderFooterEntry[] = [];

  for (const config of configs) {
    // Check page range
    const included = parsePageRange(config.pageRange, totalPages);
    if (!included.has(pageNumber)) continue;

    // Check odd/even
    if (config.oddPagesOnly && pageNumber % 2 === 0) continue;
    if (config.evenPagesOnly && pageNumber % 2 !== 0) continue;

    const text = substituteVariables(
      config.template,
      pageNumber,
      totalPages,
      fileName,
    );

    entries.push({
      text,
      position: config.position,
      alignment: config.alignment,
      fontFamily: config.fontFamily,
      fontSize: config.fontSize,
      color: config.color,
      margin: config.margin,
    });
  }

  // Page numbers
  if (pageNumberConfig?.enabled) {
    const included = parsePageRange(pageNumberConfig.pageRange, totalPages);
    if (included.has(pageNumber)) {
      const text = formatPageNumber(
        pageNumberConfig.format,
        pageNumber,
        totalPages,
        pageNumberConfig.startNumber,
      );

      entries.push({
        text,
        position: pageNumberConfig.position,
        alignment: pageNumberConfig.alignment,
        fontFamily: pageNumberConfig.fontFamily,
        fontSize: pageNumberConfig.fontSize,
        color: pageNumberConfig.color,
        margin: 30,
      });
    }
  }

  return entries;
}

/* ──────────────────────── Position Calculation ──────────────────────── */

/**
 * Calculate the X position for header/footer text given alignment and page width.
 */
export function calculateXPosition(
  alignment: 'left' | 'center' | 'right',
  pageWidth: number,
  textWidth: number,
  margin: number,
): number {
  switch (alignment) {
    case 'left':
      return margin;
    case 'center':
      return (pageWidth - textWidth) / 2;
    case 'right':
      return pageWidth - textWidth - margin;
    default:
      return margin;
  }
}

/**
 * Calculate the Y position for header/footer.
 * Returns Y in PDF bottom-left coordinate system.
 */
export function calculateYPosition(
  position: 'header' | 'footer',
  pageHeight: number,
  fontSize: number,
  margin: number,
): number {
  if (position === 'header') {
    return pageHeight - margin - fontSize;
  }
  return margin;
}

/**
 * Estimate text width for a given string and font size.
 * Uses an approximate average character width ratio.
 */
export function estimateTextWidth(text: string, fontSize: number): number {
  // Average character width is ~0.52 of font size for sans-serif
  return text.length * fontSize * 0.52;
}

/**
 * Build all header/footer entries for all pages.
 * Returns a Map of page number → entries.
 */
export function buildAllHeaderFooters(
  totalPages: number,
  pageMetadata: PageMeta[],
  fileName: string,
  configs: HeaderFooterConfig[],
  pageNumberConfig?: PageNumberConfig,
): Map<number, HeaderFooterEntry[]> {
  const result = new Map<number, HeaderFooterEntry[]>();

  for (let i = 1; i <= totalPages; i++) {
    const entries = computePageEntries(
      i,
      totalPages,
      fileName,
      configs,
      pageNumberConfig,
    );
    if (entries.length > 0) {
      result.set(i, entries);
    }
  }

  return result;
}
