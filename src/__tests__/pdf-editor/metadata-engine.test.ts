// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for metadata-engine.ts — Phase 4
 *
 * Covers createEmptyMetadata, updateMetadata, hasMetadata, getMetadataFieldCount,
 * parseKeywords, joinKeywords, formatBatesNumber, generateBatesNumbers,
 * validateBatesConfig, numberToLabel, generatePageLabels,
 * createDefaultPageLabelRange, validatePageLabelRanges
 */

import { describe, it, expect } from 'vitest';
import {
  createEmptyMetadata,
  updateMetadata,
  hasMetadata,
  getMetadataFieldCount,
  parseKeywords,
  joinKeywords,
  formatBatesNumber,
  generateBatesNumbers,
  validateBatesConfig,
  createDefaultBatesConfig,
  numberToLabel,
  generatePageLabels,
  createDefaultPageLabelRange,
  validatePageLabelRanges,
} from '@/app/dashboard/tools/pdf-editor/engine/metadata-engine';
import type {
  PdfMetadata,
  BatesConfig,
  PageLabelRange,
} from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Metadata CRUD ──────────────── */

describe('createEmptyMetadata', () => {
  it('creates metadata with empty fields', () => {
    const meta = createEmptyMetadata();
    expect(meta.title).toBe('');
    expect(meta.author).toBe('');
    expect(meta.subject).toBe('');
    expect(meta.keywords).toBe('');
    expect(meta.creator).toBe('');
    expect(meta.producer).toBe('');
    expect(meta.creationDate).toBeUndefined();
    expect(meta.modificationDate).toBeUndefined();
    expect(Object.keys(meta.custom)).toHaveLength(0);
  });
});

describe('updateMetadata', () => {
  it('merges partial updates', () => {
    const current = createEmptyMetadata();
    const updated = updateMetadata(current, { title: 'My Doc', author: 'Me' });
    expect(updated.title).toBe('My Doc');
    expect(updated.author).toBe('Me');
    expect(updated.subject).toBe('');
  });

  it('merges custom properties', () => {
    const current: PdfMetadata = {
      ...createEmptyMetadata(),
      custom: { key1: 'val1' },
    };
    const updated = updateMetadata(current, {
      custom: { key2: 'val2' },
    });
    expect(updated.custom.key1).toBe('val1');
    expect(updated.custom.key2).toBe('val2');
  });

  it('does not mutate original', () => {
    const current = createEmptyMetadata();
    updateMetadata(current, { title: 'Changed' });
    expect(current.title).toBe('');
  });
});

describe('hasMetadata', () => {
  it('returns false for empty metadata', () => {
    expect(hasMetadata(createEmptyMetadata())).toBe(false);
  });

  it('returns true when title is set', () => {
    const meta = { ...createEmptyMetadata(), title: 'Hello' };
    expect(hasMetadata(meta)).toBe(true);
  });

  it('returns true when custom props exist', () => {
    const meta = { ...createEmptyMetadata(), custom: { x: 'y' } };
    expect(hasMetadata(meta)).toBe(true);
  });

  it('returns true when date is set', () => {
    const meta = { ...createEmptyMetadata(), creationDate: new Date() };
    expect(hasMetadata(meta)).toBe(true);
  });
});

describe('getMetadataFieldCount', () => {
  it('returns 0 for empty metadata', () => {
    expect(getMetadataFieldCount(createEmptyMetadata())).toBe(0);
  });

  it('counts standard + custom fields', () => {
    const meta: PdfMetadata = {
      ...createEmptyMetadata(),
      title: 'T',
      author: 'A',
      custom: { a: '1', b: '2' },
    };
    expect(getMetadataFieldCount(meta)).toBe(4);
  });
});

/* ──────────────── Keywords ──────────────── */

describe('parseKeywords', () => {
  it('returns empty array for empty string', () => {
    expect(parseKeywords('')).toEqual([]);
  });

  it('splits on commas', () => {
    expect(parseKeywords('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('splits on semicolons', () => {
    expect(parseKeywords('x;y;z')).toEqual(['x', 'y', 'z']);
  });

  it('trims whitespace and filters empty', () => {
    expect(parseKeywords(' a , , b ')).toEqual(['a', 'b']);
  });
});

describe('joinKeywords', () => {
  it('joins with commas', () => {
    expect(joinKeywords(['a', 'b', 'c'])).toBe('a, b, c');
  });

  it('filters falsy values', () => {
    expect(joinKeywords(['a', '', 'b'])).toBe('a, b');
  });
});

/* ──────────────── Bates Numbering ──────────────── */

describe('formatBatesNumber', () => {
  it('formats with prefix and suffix', () => {
    const config: BatesConfig = {
      prefix: 'DOC-',
      suffix: '-A',
      startNumber: 1,
      numberOfDigits: 6,
      pageRange: 'all',
      position: 'bottom-right',
      fontSize: 10,
    };
    expect(formatBatesNumber(0, config)).toBe('DOC-000001-A');
  });

  it('increments from start number', () => {
    const config: BatesConfig = {
      prefix: '',
      suffix: '',
      startNumber: 100,
      numberOfDigits: 4,
      pageRange: 'all',
      position: 'bottom-left',
      fontSize: 10,
    };
    expect(formatBatesNumber(0, config)).toBe('0100');
    expect(formatBatesNumber(5, config)).toBe('0105');
  });
});

describe('generateBatesNumbers', () => {
  it('generates numbers for all pages', () => {
    const config: BatesConfig = {
      prefix: 'P',
      suffix: '',
      startNumber: 1,
      numberOfDigits: 3,
      pageRange: 'all',
      position: 'bottom-center',
      fontSize: 10,
    };
    const result = generateBatesNumbers(5, config);
    expect(result.size).toBe(5);
    expect(result.get(1)).toBe('P001');
    expect(result.get(5)).toBe('P005');
  });

  it('generates for specific page range', () => {
    const config: BatesConfig = {
      prefix: '',
      suffix: '',
      startNumber: 1,
      numberOfDigits: 3,
      pageRange: '2-4',
      position: 'bottom-right',
      fontSize: 10,
    };
    const result = generateBatesNumbers(10, config);
    expect(result.size).toBe(3);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(true);
    expect(result.has(4)).toBe(true);
    expect(result.has(5)).toBe(false);
  });
});

describe('validateBatesConfig', () => {
  it('returns no errors for valid config', () => {
    const config = createDefaultBatesConfig();
    expect(validateBatesConfig(config)).toEqual([]);
  });

  it('reports invalid number of digits', () => {
    const config: BatesConfig = {
      prefix: '',
      suffix: '',
      startNumber: 1,
      numberOfDigits: 0,
      pageRange: 'all',
      position: 'bottom-right',
      fontSize: 10,
    };
    expect(validateBatesConfig(config).length).toBeGreaterThan(0);
  });

  it('reports negative start number', () => {
    const config: BatesConfig = {
      prefix: '',
      suffix: '',
      startNumber: -1,
      numberOfDigits: 6,
      pageRange: 'all',
      position: 'bottom-right',
      fontSize: 10,
    };
    expect(validateBatesConfig(config).length).toBeGreaterThan(0);
  });

  it('reports invalid font size', () => {
    const config: BatesConfig = {
      prefix: '',
      suffix: '',
      startNumber: 1,
      numberOfDigits: 6,
      pageRange: 'all',
      position: 'bottom-right',
      fontSize: 2,
    };
    expect(validateBatesConfig(config).length).toBeGreaterThan(0);
  });
});

/* ──────────────── Page Labels ──────────────── */

describe('numberToLabel', () => {
  it('returns decimal as string', () => {
    expect(numberToLabel(5, 'decimal')).toBe('5');
  });

  it('converts to Roman upper', () => {
    expect(numberToLabel(4, 'roman-upper')).toBe('IV');
    expect(numberToLabel(10, 'roman-upper')).toBe('X');
    expect(numberToLabel(14, 'roman-upper')).toBe('XIV');
  });

  it('converts to Roman lower', () => {
    expect(numberToLabel(4, 'roman-lower')).toBe('iv');
  });

  it('converts to alpha upper', () => {
    expect(numberToLabel(1, 'alpha-upper')).toBe('A');
    expect(numberToLabel(26, 'alpha-upper')).toBe('Z');
    expect(numberToLabel(27, 'alpha-upper')).toBe('AA');
  });

  it('converts to alpha lower', () => {
    expect(numberToLabel(1, 'alpha-lower')).toBe('a');
    expect(numberToLabel(3, 'alpha-lower')).toBe('c');
  });
});

describe('generatePageLabels', () => {
  it('generates decimal labels for all pages with no ranges', () => {
    const labels = generatePageLabels(5, []);
    expect(labels.size).toBe(5);
    // No active range → fallback to String(page)
    expect(labels.get(1)).toBe('1');
    expect(labels.get(5)).toBe('5');
  });

  it('applies label range correctly', () => {
    const ranges: PageLabelRange[] = [
      { startPage: 1, style: 'roman-lower', prefix: '', startLabelNumber: 1 },
    ];
    const labels = generatePageLabels(5, ranges);
    expect(labels.get(1)).toBe('i');
    expect(labels.get(4)).toBe('iv');
  });

  it('transitions between ranges', () => {
    const ranges: PageLabelRange[] = [
      { startPage: 1, style: 'roman-lower', prefix: '', startLabelNumber: 1 },
      { startPage: 4, style: 'decimal', prefix: '', startLabelNumber: 1 },
    ];
    const labels = generatePageLabels(6, ranges);
    expect(labels.get(1)).toBe('i');
    expect(labels.get(3)).toBe('iii');
    expect(labels.get(4)).toBe('1'); // transitions to decimal
    expect(labels.get(6)).toBe('3');
  });

  it('supports prefix', () => {
    const ranges: PageLabelRange[] = [
      { startPage: 1, style: 'decimal', prefix: 'A-', startLabelNumber: 1 },
    ];
    const labels = generatePageLabels(3, ranges);
    expect(labels.get(1)).toBe('A-1');
    expect(labels.get(3)).toBe('A-3');
  });
});

describe('createDefaultPageLabelRange', () => {
  it('creates range with decimal style', () => {
    const range = createDefaultPageLabelRange();
    expect(range.startPage).toBe(1);
    expect(range.style).toBe('decimal');
    expect(range.prefix).toBe('');
    expect(range.startLabelNumber).toBe(1);
  });

  it('accepts custom start page', () => {
    const range = createDefaultPageLabelRange(5);
    expect(range.startPage).toBe(5);
  });
});

describe('validatePageLabelRanges', () => {
  it('returns no errors for valid ranges', () => {
    const ranges: PageLabelRange[] = [
      { startPage: 1, style: 'decimal', prefix: '', startLabelNumber: 1 },
    ];
    expect(validatePageLabelRanges(ranges, 10)).toEqual([]);
  });

  it('reports out-of-range start page', () => {
    const ranges: PageLabelRange[] = [
      { startPage: 20, style: 'decimal', prefix: '', startLabelNumber: 1 },
    ];
    const errors = validatePageLabelRanges(ranges, 10);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('reports duplicate start pages', () => {
    const ranges: PageLabelRange[] = [
      { startPage: 1, style: 'decimal', prefix: '', startLabelNumber: 1 },
      { startPage: 1, style: 'roman-upper', prefix: '', startLabelNumber: 1 },
    ];
    const errors = validatePageLabelRanges(ranges, 10);
    expect(errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('reports invalid start label number', () => {
    const ranges: PageLabelRange[] = [
      { startPage: 1, style: 'decimal', prefix: '', startLabelNumber: 0 },
    ];
    const errors = validatePageLabelRanges(ranges, 10);
    expect(errors.length).toBeGreaterThan(0);
  });
});
