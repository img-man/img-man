// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for text-extractor.ts — Phase 3
 *
 * Covers mapFontName, inferFontWeight, inferFontStyle, findInTextBlocks,
 * replaceMatch, replaceAllMatches, mergeAdjacentBlocks, getPagePlainText
 */

import { describe, it, expect } from 'vitest';
import {
  mapFontName,
  inferFontWeight,
  inferFontStyle,
  mergeAdjacentBlocks,
  findInTextBlocks,
  replaceMatch,
  replaceAllMatches,
  getPagePlainText,
} from '@/app/dashboard/tools/pdf-editor/engine/text-extractor';
import type { ExtractedTextBlock } from '@/app/dashboard/tools/pdf-editor/types';

/* ──────────────── Helper: create a text block ──────────────── */

function makeBlock(
  text: string,
  page = 1,
  x = 0,
  y = 0,
  fontFamily = 'Arial',
): ExtractedTextBlock {
  return {
    text,
    x,
    y,
    width: text.length * 8,
    height: 12,
    fontSize: 12,
    fontFamily,
    fontWeight: 'normal',
    fontStyle: 'normal',
    color: '#000000',
    page,
  };
}

/* ──────────────────────── Font Mapping ──────────────────────── */

describe('mapFontName', () => {
  it('should return fallback for empty input', () => {
    expect(mapFontName('')).toBe('Helvetica');
  });

  it('should map known PDF fonts', () => {
    expect(mapFontName('Helvetica')).toBe('Helvetica');
    expect(mapFontName('Times-Roman')).toBe('Times New Roman');
    expect(mapFontName('Courier')).toBe('Courier New');
  });

  it('should strip subset prefix (AAAAAB+)', () => {
    expect(mapFontName('ABCDEF+Helvetica')).toBe('Helvetica');
  });

  it('should handle unknown fonts gracefully', () => {
    const result = mapFontName('MyCustomFont');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

/* ──────────────────────── Font Weight / Style Inference ──────────────────────── */

describe('inferFontWeight', () => {
  it('should detect bold', () => {
    expect(inferFontWeight('Helvetica-Bold')).toBe('bold');
    expect(inferFontWeight('Arial-Heavy')).toBe('bold');
    expect(inferFontWeight('TimesBlack')).toBe('bold');
  });

  it('should default to normal', () => {
    expect(inferFontWeight('Helvetica')).toBe('normal');
    expect(inferFontWeight('Arial')).toBe('normal');
  });
});

describe('inferFontStyle', () => {
  it('should detect italic', () => {
    expect(inferFontStyle('Helvetica-Italic')).toBe('italic');
    expect(inferFontStyle('TimesOblique')).toBe('italic');
  });

  it('should default to normal', () => {
    expect(inferFontStyle('Helvetica')).toBe('normal');
  });
});

/* ──────────────────────── Merge Adjacent Blocks ──────────────────────── */

describe('mergeAdjacentBlocks', () => {
  it('should merge adjacent blocks with same font', () => {
    const blocks: ExtractedTextBlock[] = [
      makeBlock('Hello ', 1, 0, 10),
      makeBlock('world', 1, 48, 10),
    ];
    const merged = mergeAdjacentBlocks(blocks, 20);
    expect(merged.length).toBe(1);
    expect(merged[0].text).toBe('Hello world');
  });

  it('should keep separate blocks that are far apart', () => {
    const blocks: ExtractedTextBlock[] = [
      makeBlock('Hello', 1, 0, 10),
      makeBlock('world', 1, 500, 10),
    ];
    const merged = mergeAdjacentBlocks(blocks, 20);
    expect(merged.length).toBe(2);
  });

  it('should return empty array for empty input', () => {
    expect(mergeAdjacentBlocks([], 20)).toEqual([]);
  });
});

/* ──────────────────────── Find in Text Blocks ──────────────────────── */

describe('findInTextBlocks', () => {
  const blocks = new Map<number, ExtractedTextBlock[]>();
  blocks.set(1, [
    makeBlock('The quick brown fox jumps over the lazy dog', 1),
    makeBlock('A second line with fox again', 1),
  ]);
  blocks.set(2, [makeBlock('Page two has no match here', 2)]);

  it('should find all case-insensitive matches', () => {
    const matches = findInTextBlocks(blocks, 'fox', false, false);
    expect(matches.length).toBe(2);
    expect(matches[0].page).toBe(1);
  });

  it('should respect case sensitivity', () => {
    const matches = findInTextBlocks(blocks, 'Fox', true, false);
    expect(matches.length).toBe(0);
  });

  it('should support regex search', () => {
    const matches = findInTextBlocks(blocks, 'f[o0]x', false, true);
    expect(matches.length).toBe(2);
  });

  it('should return empty for empty query', () => {
    const matches = findInTextBlocks(blocks, '', false, false);
    expect(matches.length).toBe(0);
  });

  it('should handle invalid regex gracefully', () => {
    const matches = findInTextBlocks(blocks, '[invalid', false, true);
    expect(matches.length).toBe(0);
  });
});

/* ──────────────────────── Replace ──────────────────────── */

describe('replaceMatch', () => {
  it('should replace text at the specified match position', () => {
    const blocks = new Map<number, ExtractedTextBlock[]>();
    blocks.set(1, [makeBlock('Hello world Hello', 1)]);

    const matches = findInTextBlocks(blocks, 'Hello', false, false);
    expect(matches.length).toBe(2);

    // Replace first match
    replaceMatch(blocks, matches[0], 'Hi');
    const text = blocks.get(1)![0].text;
    expect(text).toBe('Hi world Hello');
  });
});

describe('replaceAllMatches', () => {
  it('should replace all matches across pages', () => {
    const blocks = new Map<number, ExtractedTextBlock[]>();
    blocks.set(1, [makeBlock('cat and cat', 1)]);
    blocks.set(2, [makeBlock('another cat here', 2)]);

    const matches = findInTextBlocks(blocks, 'cat', false, false);
    expect(matches.length).toBe(3);

    const count = replaceAllMatches(blocks, matches, 'dog');
    expect(count).toBe(3);

    expect(blocks.get(1)![0].text).toBe('dog and dog');
    expect(blocks.get(2)![0].text).toBe('another dog here');
  });
});

/* ──────────────────────── Plain Text ──────────────────────── */

describe('getPagePlainText', () => {
  it('should concatenate all block texts with newlines', () => {
    const blocks: ExtractedTextBlock[] = [
      makeBlock('Line one', 1),
      makeBlock('Line two', 1),
    ];
    const text = getPagePlainText(blocks);
    expect(text).toContain('Line one');
    expect(text).toContain('Line two');
  });

  it('should return empty for empty blocks', () => {
    expect(getPagePlainText([])).toBe('');
  });
});
