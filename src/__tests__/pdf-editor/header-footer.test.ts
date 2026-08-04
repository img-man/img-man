// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for header-footer.ts — Phase 3
 *
 * Covers substituteVariables, toRoman, formatPageNumber, parsePageRange,
 * computePageEntries, calculateXPosition, calculateYPosition, estimateTextWidth
 */

import { describe, it, expect } from 'vitest';
import {
  substituteVariables,
  toRoman,
  formatPageNumber,
  parsePageRange,
  computePageEntries,
  calculateXPosition,
  calculateYPosition,
  estimateTextWidth,
} from '@/app/dashboard/tools/pdf-editor/engine/header-footer';
import type { HeaderFooterConfig } from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────────────── substituteVariables ──────────────────────── */

describe('substituteVariables', () => {
  it('should replace {page} with current page number', () => {
    expect(substituteVariables('Page {page}', 3, 10, 'doc.pdf')).toBe('Page 3');
  });

  it('should replace {pages} with total pages', () => {
    expect(substituteVariables('{pages} total', 1, 25, 'doc.pdf')).toBe(
      '25 total',
    );
  });

  it('should replace {filename}', () => {
    expect(substituteVariables('File: {filename}', 1, 10, 'report.pdf')).toBe(
      'File: report.pdf',
    );
  });

  it('should replace {date} with a date string', () => {
    const result = substituteVariables('{date}', 1, 1, 'doc.pdf');
    // Should be a valid date string (not "{date}")
    expect(result).not.toContain('{date}');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle multiple variables', () => {
    const result = substituteVariables(
      'Page {page} of {pages}',
      5,
      20,
      'doc.pdf',
    );
    expect(result).toBe('Page 5 of 20');
  });

  it('should return template unchanged if no variables', () => {
    expect(substituteVariables('Static text', 1, 1, 'doc.pdf')).toBe(
      'Static text',
    );
  });
});

/* ──────────────────────── toRoman ──────────────────────── */

describe('toRoman', () => {
  it('should convert 1 to i', () => {
    expect(toRoman(1)).toBe('i');
  });

  it('should convert 4 to iv', () => {
    expect(toRoman(4)).toBe('iv');
  });

  it('should convert 9 to ix', () => {
    expect(toRoman(9)).toBe('ix');
  });

  it('should convert 42 to xlii', () => {
    expect(toRoman(42)).toBe('xlii');
  });

  it('should convert 2024 to mmxxiv', () => {
    expect(toRoman(2024)).toBe('mmxxiv');
  });

  it('should return stringified number for zero or negative', () => {
    expect(toRoman(0)).toBe('0');
    expect(toRoman(-1)).toBe('-1');
  });
});

/* ──────────────────────── formatPageNumber ──────────────────────── */

describe('formatPageNumber', () => {
  it('should format decimal', () => {
    expect(formatPageNumber('decimal', 5, 20, 1)).toBe('5');
  });

  it('should format decimal-total', () => {
    expect(formatPageNumber('decimal-total', 5, 20, 1)).toBe('5/20');
  });

  it('should format page-of', () => {
    expect(formatPageNumber('page-of', 3, 10, 1)).toBe('Page 3 of 10');
  });

  it('should format roman', () => {
    expect(formatPageNumber('roman', 4, 10, 1)).toBe('iv');
  });
});

/* ──────────────────────── parsePageRange ──────────────────────── */

describe('parsePageRange', () => {
  it('should return all pages for "all"', () => {
    const pages = parsePageRange('all', 5);
    expect(pages.size).toBe(5);
    expect(pages.has(1)).toBe(true);
    expect(pages.has(5)).toBe(true);
  });

  it('should parse comma-separated pages', () => {
    const pages = parsePageRange('1,3,5', 10);
    expect(pages.size).toBe(3);
    expect(pages.has(1)).toBe(true);
    expect(pages.has(3)).toBe(true);
    expect(pages.has(5)).toBe(true);
  });

  it('should parse ranges', () => {
    const pages = parsePageRange('2-5', 10);
    expect(pages.size).toBe(4);
    expect(pages.has(2)).toBe(true);
    expect(pages.has(5)).toBe(true);
    expect(pages.has(6)).toBe(false);
  });

  it('should handle mixed ranges and singles', () => {
    const pages = parsePageRange('1,3-5,8', 10);
    expect(pages.size).toBe(5);
  });

  it('should clamp to totalPages', () => {
    const pages = parsePageRange('1-100', 5);
    expect(pages.size).toBe(5);
  });
});

/* ──────────────────────── computePageEntries ──────────────────────── */

describe('computePageEntries', () => {
  it('should compute entries for all pages', () => {
    const config: HeaderFooterConfig = {
      id: 'hf-1',
      template: 'Page {page}',
      position: 'header',
      alignment: 'center',
      pageRange: 'all',
      fontFamily: 'Arial',
      fontSize: 10,
      color: '#000000',
      oddPagesOnly: false,
      evenPagesOnly: false,
      margin: 36,
    };

    // computePageEntries is per-page — collect entries for all 5 pages
    const allEntries: { text: string; page: number }[] = [];
    for (let p = 1; p <= 5; p++) {
      const entries = computePageEntries(p, 5, 'doc.pdf', [config]);
      entries.forEach((e) => allEntries.push({ text: e.text, page: p }));
    }
    expect(allEntries.length).toBe(5);
    expect(allEntries[0].text).toBe('Page 1');
    expect(allEntries[4].text).toBe('Page 5');
  });

  it('should filter odd pages only', () => {
    const config: HeaderFooterConfig = {
      id: 'hf-2',
      template: '{page}',
      position: 'footer',
      alignment: 'right',
      pageRange: 'all',
      fontFamily: 'Arial',
      fontSize: 10,
      color: '#000000',
      oddPagesOnly: true,
      evenPagesOnly: false,
      margin: 36,
    };

    const pages: number[] = [];
    for (let p = 1; p <= 6; p++) {
      const entries = computePageEntries(p, 6, 'doc.pdf', [config]);
      if (entries.length > 0) pages.push(p);
    }
    expect(pages).toEqual([1, 3, 5]);
  });

  it('should filter even pages only', () => {
    const config: HeaderFooterConfig = {
      id: 'hf-3',
      template: '{page}',
      position: 'footer',
      alignment: 'left',
      pageRange: 'all',
      fontFamily: 'Arial',
      fontSize: 10,
      color: '#000000',
      oddPagesOnly: false,
      evenPagesOnly: true,
      margin: 36,
    };

    const pages: number[] = [];
    for (let p = 1; p <= 6; p++) {
      const entries = computePageEntries(p, 6, 'doc.pdf', [config]);
      if (entries.length > 0) pages.push(p);
    }
    expect(pages).toEqual([2, 4, 6]);
  });
});

/* ──────────────────────── Position Calculations ──────────────────────── */

describe('calculateXPosition', () => {
  it('should center text on the page', () => {
    const x = calculateXPosition('center', 612, 50, 36);
    expect(x).toBeCloseTo(281, 0); // (612 - 50) / 2
  });

  it('should left-align with margin', () => {
    const x = calculateXPosition('left', 612, 50, 36);
    expect(x).toBeGreaterThanOrEqual(36);
  });

  it('should right-align with margin', () => {
    const x = calculateXPosition('right', 612, 50, 36);
    expect(x).toBeLessThanOrEqual(612);
  });
});

describe('calculateYPosition', () => {
  it('should place header at top', () => {
    const y = calculateYPosition('header', 792, 12, 36);
    expect(y).toBeGreaterThan(700); // PDF coordinates: top has high y
  });

  it('should place footer at bottom', () => {
    const y = calculateYPosition('footer', 792, 12, 36);
    expect(y).toBeLessThan(100); // PDF coordinates: bottom has low y
  });
});

/* ──────────────────────── Text Width Estimation ──────────────────────── */

describe('estimateTextWidth', () => {
  it('should return a positive width', () => {
    expect(estimateTextWidth('Hello', 12)).toBeGreaterThan(0);
  });

  it('should scale with font size', () => {
    const w12 = estimateTextWidth('Hello', 12);
    const w24 = estimateTextWidth('Hello', 24);
    expect(w24).toBeGreaterThan(w12);
  });

  it('should return 0 for empty string', () => {
    expect(estimateTextWidth('', 12)).toBe(0);
  });
});
